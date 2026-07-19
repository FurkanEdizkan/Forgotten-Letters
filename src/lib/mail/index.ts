/**
 * Transactional email.
 *
 * Plain SMTP in both environments: Mailpit locally (read the inbox at
 * http://localhost:8025), Amazon SES in production. Only host/port/creds
 * differ. See docs/BuildPlan.md §A3.
 *
 * Note: nodemailer is pinned to 9.x via an npm override — next-auth v5
 * peers an older 7.x that carries unpatched SMTP-injection advisories.
 * Rationale is recorded in package.json. Do not route mail through
 * next-auth's Email provider without re-checking that pin.
 */
import nodemailer, { type Transporter } from "nodemailer";

import { env } from "@/lib/env";

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SES_SMTP_HOST,
    port: env.SES_SMTP_PORT,
    secure: env.SES_SMTP_SECURE,
    // Mailpit accepts unauthenticated mail; SES requires credentials.
    auth: env.SES_SMTP_USER
      ? { user: env.SES_SMTP_USER, pass: env.SES_SMTP_PASSWORD }
      : undefined,
  });
  return transporter;
}

export type SendMailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Send a transactional message.
 *
 * Header values are passed as discrete fields so nodemailer encodes them;
 * never interpolate user input into a raw header string — that is the
 * CRLF-injection path the pinned advisories describe.
 */
export async function sendMail(opts: SendMailOptions): Promise<void> {
  await getTransporter().sendMail({
    from: env.EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}

/** Liveness probe for /api/health. Returns false rather than throwing. */
export async function pingMail(): Promise<boolean> {
  try {
    await getTransporter().verify();
    return true;
  } catch {
    return false;
  }
}
