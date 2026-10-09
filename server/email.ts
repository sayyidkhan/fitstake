import nodemailer from "nodemailer";
import { HttpError } from "./service.js";

export const emailConfigured = () =>
  Boolean((process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) || process.env.RESEND_API_KEY);

// Sends a plain-text email. Uses Gmail (an app password) when configured, else Resend.
// Returns false when no email service is configured.
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (user && pass) {
    try {
      const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
      await transport.sendMail({ from: `FitStake <${user}>`, to, subject, text });
      return true;
    } catch (err) {
      console.error("gmail send failed", err instanceof Error ? err.message : err);
      throw new HttpError(502, "We couldn’t send the email. Please try again in a moment.");
    }
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "FitStake <onboarding@resend.dev>", to: [to], subject, text }),
  });
  if (!res.ok) {
    console.error("email send failed", res.status, (await res.text()).slice(0, 300));
    throw new HttpError(502, "We couldn’t send the email. Please try again in a moment.");
  }
  return true;
}
