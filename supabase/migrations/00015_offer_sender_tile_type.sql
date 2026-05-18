-- Add 'offer_sender' tile type for AI-personalized HTML email offers sent via SendGrid
ALTER TYPE public.tile_type ADD VALUE IF NOT EXISTS 'offer_sender';
