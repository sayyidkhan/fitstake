import { afterEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn().mockResolvedValue({});
const createTransport = vi.fn(() => ({ sendMail }));
vi.mock("nodemailer", () => ({ default: { createTransport } }));

const ENV = ["GMAIL_USER", "GMAIL_APP_PASSWORD", "RESEND_API_KEY"] as const;
afterEach(() => {
  for (const k of ENV) delete process.env[k];
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("email provider", () => {
  it("sends through Gmail SMTP with the app password when configured", async () => {
    process.env.GMAIL_USER = "owner@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
    const { sendEmail } = await import("../server/email");
    await expect(sendEmail("friend@example.com", "Your code", "123456")).resolves.toBe(true);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "owner@gmail.com", pass: "abcd efgh ijkl mnop" } }),
    );
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "friend@example.com", from: "FitStake <owner@gmail.com>", subject: "Your code" }));
  });

  it("returns false when nothing is configured", async () => {
    const { sendEmail, emailConfigured } = await import("../server/email");
    expect(emailConfigured()).toBe(false);
    await expect(sendEmail("a@b.co", "s", "t")).resolves.toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("turns a Gmail failure into a friendly error without leaking details", async () => {
    process.env.GMAIL_USER = "owner@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "bad";
    sendMail.mockRejectedValueOnce(new Error("535 Username and Password not accepted"));
    const { sendEmail } = await import("../server/email");
    await expect(sendEmail("a@b.co", "s", "t")).rejects.toThrow(/couldn’t send the email/);
  });

  it("falls back to Resend when only that key is set", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { sendEmail } = await import("../server/email");
    await expect(sendEmail("a@b.co", "s", "t")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.anything());
    expect(createTransport).not.toHaveBeenCalled();
  });
});
