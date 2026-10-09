import { HttpError } from "./service.js";

// Sends a plain-text email through Resend. Returns false when no email service is configured.
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "FitStake <onboarding@resend.dev>",
      to: [to],
      subject,
      text,
    }),
  });
  if (!res.ok) {
    console.error("email send failed", res.status, (await res.text()).slice(0, 300));
    throw new HttpError(502, "We couldn’t send the email. Please try again in a moment.");
  }
  return true;
}
