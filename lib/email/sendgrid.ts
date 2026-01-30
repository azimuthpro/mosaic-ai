import { readFileSync } from "fs";
import { join } from "path";

/**
 * SendGrid Email Utility
 *
 * Provides functions for sending transactional emails via SendGrid API.
 * Used for workspace invitations and other system emails.
 */

const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

const templateCache = new Map<string, string>();

function getSenderConfig(): { email: string; name: string } {
  return {
    email: process.env.SENDGRID_FROM_EMAIL || "noreply@mosaic-ai.app",
    name: process.env.SENDGRID_FROM_NAME || "Mosaic AI",
  };
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

interface SendGridPersonalization {
  to: { email: string; name?: string }[];
  subject: string;
}

interface SendGridContent {
  type: "text/plain" | "text/html";
  value: string;
}

interface SendGridPayload {
  personalizations: SendGridPersonalization[];
  from: { email: string; name?: string };
  reply_to?: { email: string; name?: string };
  subject: string;
  content: SendGridContent[];
}

interface SendEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send an email via SendGrid API
 */
async function sendEmail(payload: SendGridPayload): Promise<SendEmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.error("SendGrid API key not configured");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SendGrid API error:", response.status, errorText);
      return { success: false, error: `Email send failed: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error("SendGrid request error:", error);
    return { success: false, error: "Failed to send email" };
  }
}

interface InvitationEmailParams {
  recipientEmail: string;
  recipientName?: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  invitationToken: string;
}

/**
 * Send a workspace invitation email
 */
export async function sendInvitationEmail(
  params: InvitationEmailParams,
): Promise<SendEmailResult> {
  const {
    recipientEmail,
    recipientName,
    workspaceName,
    inviterName,
    role,
    invitationToken,
  } = params;

  const sender = getSenderConfig();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const invitationUrl = `${baseUrl}/signup?invitation=${invitationToken}`;
  const roleDisplay = capitalize(role);
  const subject = `${inviterName} invited you to join ${workspaceName}`;

  const htmlContent = generateInvitationEmailHtml({
    workspaceName,
    inviterName,
    role: roleDisplay,
    invitationUrl,
  });

  const textContent = `
${inviterName} has invited you to join ${workspaceName} as a ${roleDisplay}.

Click here to accept the invitation:
${invitationUrl}

This invitation expires in 7 days.

If you didn't expect this invitation, you can safely ignore this email.
`.trim();

  const payload: SendGridPayload = {
    personalizations: [
      {
        to: [{ email: recipientEmail, name: recipientName }],
        subject,
      },
    ],
    from: sender,
    subject,
    content: [
      { type: "text/plain", value: textContent },
      { type: "text/html", value: htmlContent },
    ],
  };

  return sendEmail(payload);
}

interface InvitationEmailHtmlParams {
  workspaceName: string;
  inviterName: string;
  role: string;
  invitationUrl: string;
}

function loadTemplate(templateName: string): string | null {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName)!;
  }

  try {
    const templatePath = join(
      process.cwd(),
      `lib/email/templates/${templateName}`,
    );
    const template = readFileSync(templatePath, "utf8");
    templateCache.set(templateName, template);
    return template;
  } catch (error) {
    console.error(`Failed to read template ${templateName}:`, error);
    return null;
  }
}

function generateInvitationEmailHtml(
  params: InvitationEmailHtmlParams,
): string {
  const { workspaceName, inviterName, role, invitationUrl } = params;

  const template = loadTemplate("mosaic-invitation.html");
  if (!template) {
    return `
      <h1>Invitation to ${workspaceName}</h1>
      <p>${inviterName} invited you to join as ${role}.</p>
      <a href="${invitationUrl}">Accept Invitation</a>
    `;
  }

  return template
    .replaceAll("{{inviter_name}}", inviterName)
    .replaceAll("{{workspace_name}}", workspaceName)
    .replaceAll("{{role}}", role)
    .replaceAll("{{invitation_link}}", invitationUrl)
    .replaceAll("{{expiry_minutes}}", "10080");
}

interface MagicLinkEmailParams {
  recipientEmail: string;
  recipientName?: string;
  magicLinkUrl: string;
  type?: "signin" | "signup";
}

/**
 * Send a magic link email for authentication
 */
export async function sendMagicLinkEmail(
  params: MagicLinkEmailParams,
): Promise<SendEmailResult> {
  const {
    recipientEmail,
    recipientName,
    magicLinkUrl,
    type = "signin",
  } = params;

  const sender = getSenderConfig();
  const subject =
    type === "signup" ? "Welcome to Mosaic AI" : "Sign in to Mosaic AI";
  const htmlContent = generateMagicLinkEmailHtml(magicLinkUrl, type);

  const textContent = `
Sign in to Mosaic AI

Click the link below to sign in to your Mosaic AI account:
${magicLinkUrl}

This link expires in 60 minutes. If you didn't request this login link, you can safely ignore this email.
`.trim();

  const payload: SendGridPayload = {
    personalizations: [
      {
        to: [{ email: recipientEmail, name: recipientName }],
        subject,
      },
    ],
    from: sender,
    subject,
    content: [
      { type: "text/plain", value: textContent },
      { type: "text/html", value: htmlContent },
    ],
  };

  return sendEmail(payload);
}

function generateMagicLinkEmailHtml(
  magicLinkUrl: string,
  type: "signin" | "signup",
): string {
  const templateName =
    type === "signup" ? "magic-link-signup.html" : "magic-link-signin.html";
  const template = loadTemplate(templateName);

  if (!template) {
    const heading =
      type === "signup" ? "Welcome to Mosaic AI" : "Sign in to Mosaic AI";
    const buttonText =
      type === "signup" ? "Get Started" : "Sign in to Mosaic AI";
    return `
      <h1>${heading}</h1>
      <p>Click the link below to sign in:</p>
      <a href="${magicLinkUrl}">${buttonText}</a>
    `;
  }

  return template.replaceAll("{{magic_link}}", magicLinkUrl);
}
