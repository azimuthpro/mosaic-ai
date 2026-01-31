-- Migration: Mosaic Invitations
-- Adds support for pending invitations to non-existing users

-- ============================================================================
-- INVITATION STATUS ENUM
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status') THEN
    CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');
  END IF;
END
$$;

COMMENT ON TYPE invitation_status IS 'Status of a mosaic invitation';

-- ============================================================================
-- MOSAIC_INVITATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mosaic_invitations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mosaic_id uuid REFERENCES public.mosaics(id) ON DELETE CASCADE NOT NULL,
  email varchar(255) NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  token uuid DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status invitation_status DEFAULT 'pending' NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '7 days') NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Drop old constraint if it exists and create partial unique index
-- This allows re-inviting after cancellation while preventing duplicate pending invitations
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_pending_invitation'
  ) THEN
    ALTER TABLE public.mosaic_invitations DROP CONSTRAINT unique_pending_invitation;
  END IF;
END
$$;

-- Create partial unique index for pending invitations only
DROP INDEX IF EXISTS idx_unique_pending_invitation;
CREATE UNIQUE INDEX idx_unique_pending_invitation
  ON public.mosaic_invitations (mosaic_id, email)
  WHERE status = 'pending';

COMMENT ON TABLE mosaic_invitations IS 'Pending invitations for users who do not yet have an account';
COMMENT ON COLUMN mosaic_invitations.token IS 'Unique token for invitation acceptance';
COMMENT ON COLUMN mosaic_invitations.expires_at IS 'Invitation expiry time (default 7 days)';

-- RLS for mosaic_invitations
ALTER TABLE public.mosaic_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Owners can manage invitations" ON public.mosaic_invitations;
DROP POLICY IF EXISTS "Users can view their invitations" ON public.mosaic_invitations;
DROP POLICY IF EXISTS "Service role can update invitations" ON public.mosaic_invitations;

-- Mosaic owners can manage invitations
CREATE POLICY "Owners can manage invitations"
  ON public.mosaic_invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.mosaics
      WHERE mosaics.id = mosaic_invitations.mosaic_id
      AND mosaics.owner_id = auth.uid()
    )
  );

-- Users can view invitations sent to their email
CREATE POLICY "Users can view their invitations"
  ON public.mosaic_invitations FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Note: Service role bypasses RLS, so no separate policy needed for invitation acceptance.
-- The accept_mosaic_invitation function uses SECURITY DEFINER which runs as the function owner.

-- Indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_mosaic_invitations_mosaic ON public.mosaic_invitations(mosaic_id);
CREATE INDEX IF NOT EXISTS idx_mosaic_invitations_email ON public.mosaic_invitations(email);
CREATE INDEX IF NOT EXISTS idx_mosaic_invitations_token ON public.mosaic_invitations(token);
CREATE INDEX IF NOT EXISTS idx_mosaic_invitations_status ON public.mosaic_invitations(status) WHERE status = 'pending';

-- Updated at trigger (drop and recreate for idempotency)
DROP TRIGGER IF EXISTS update_mosaic_invitations_updated_at ON public.mosaic_invitations;
CREATE TRIGGER update_mosaic_invitations_updated_at
  BEFORE UPDATE ON public.mosaic_invitations
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

-- ============================================================================
-- FUNCTION: Accept invitation and add user to mosaic
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_mosaic_invitation(
  p_token uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_user_email text;
  v_member_id uuid;
BEGIN
  -- Get user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Get and validate invitation
  SELECT * INTO v_invitation
  FROM mosaic_invitations
  WHERE token = p_token
  AND status = 'pending'
  AND expires_at > now()
  FOR UPDATE;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  -- Check email matches
  IF lower(v_invitation.email) != lower(v_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation email does not match');
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM mosaic_members
    WHERE mosaic_id = v_invitation.mosaic_id
    AND user_id = p_user_id
  ) THEN
    -- Mark invitation as accepted even if already a member
    UPDATE mosaic_invitations
    SET status = 'accepted', updated_at = now()
    WHERE id = v_invitation.id;

    RETURN jsonb_build_object('success', true, 'already_member', true, 'mosaic_id', v_invitation.mosaic_id);
  END IF;

  -- Check if user is the owner (shouldn't happen, but safety check)
  IF EXISTS (
    SELECT 1 FROM mosaics
    WHERE id = v_invitation.mosaic_id
    AND owner_id = p_user_id
  ) THEN
    UPDATE mosaic_invitations
    SET status = 'accepted', updated_at = now()
    WHERE id = v_invitation.id;

    RETURN jsonb_build_object('success', true, 'already_member', true, 'mosaic_id', v_invitation.mosaic_id);
  END IF;

  -- Add user to mosaic members
  INSERT INTO mosaic_members (mosaic_id, user_id, role)
  VALUES (v_invitation.mosaic_id, p_user_id, v_invitation.role)
  RETURNING id INTO v_member_id;

  -- Mark invitation as accepted
  UPDATE mosaic_invitations
  SET status = 'accepted', updated_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'member_id', v_member_id,
    'mosaic_id', v_invitation.mosaic_id,
    'role', v_invitation.role
  );
END;
$$;

COMMENT ON FUNCTION accept_mosaic_invitation IS 'Accept a mosaic invitation and add user as a member';

-- ============================================================================
-- FUNCTION: Transfer mosaic ownership
-- ============================================================================

CREATE OR REPLACE FUNCTION transfer_mosaic_ownership(
  p_mosaic_id uuid,
  p_current_owner_id uuid,
  p_new_owner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mosaic RECORD;
  v_new_owner_member RECORD;
BEGIN
  -- Verify current user is the owner
  SELECT * INTO v_mosaic
  FROM mosaics
  WHERE id = p_mosaic_id
  AND owner_id = p_current_owner_id
  FOR UPDATE;

  IF v_mosaic IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mosaic not found or you are not the owner');
  END IF;

  -- Verify new owner is an admin member
  SELECT * INTO v_new_owner_member
  FROM mosaic_members
  WHERE mosaic_id = p_mosaic_id
  AND user_id = p_new_owner_id
  AND role = 'admin';

  IF v_new_owner_member IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'New owner must be an admin of this mosaic');
  END IF;

  -- Remove new owner from members (they're becoming the owner)
  DELETE FROM mosaic_members
  WHERE mosaic_id = p_mosaic_id
  AND user_id = p_new_owner_id;

  -- Add current owner as admin
  INSERT INTO mosaic_members (mosaic_id, user_id, role)
  VALUES (p_mosaic_id, p_current_owner_id, 'admin');

  -- Transfer ownership
  UPDATE mosaics
  SET owner_id = p_new_owner_id, updated_at = now()
  WHERE id = p_mosaic_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_owner_id', p_new_owner_id,
    'previous_owner_id', p_current_owner_id
  );
END;
$$;

COMMENT ON FUNCTION transfer_mosaic_ownership IS 'Transfer mosaic ownership to an admin member';
