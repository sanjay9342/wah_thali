import "server-only";

import nodemailer from "nodemailer";
import { readServerEnv } from "@/lib/server-env";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function truthy(value: string) {
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readSmtpPort(secure: boolean) {
  const raw = readServerEnv("SMTP_PORT");
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : secure ? 465 : 587;
}

export function getMailConfig() {
  const host = readServerEnv("SMTP_HOST", ["MAIL_HOST"]);
  const user = readServerEnv("SMTP_USER", ["MAIL_USER"]);
  const password = readServerEnv("SMTP_PASSWORD", ["SMTP_PASS", "MAIL_PASSWORD", "MAIL_PASS"]);
  const from = readServerEnv("SMTP_FROM", ["MAIL_FROM", "SMTP_FROM_EMAIL"]) || user;
  const secure = truthy(readServerEnv("SMTP_SECURE", ["MAIL_SECURE"]));

  return {
    host,
    port: readSmtpPort(secure),
    secure,
    user,
    password,
    from,
  };
}

export function isMailConfigured() {
  const config = getMailConfig();
  const authComplete = (!config.user && !config.password) || Boolean(config.user && config.password);
  return Boolean(config.host && config.from && authComplete);
}

export async function sendMail(input: MailInput) {
  const config = getMailConfig();

  if (!isMailConfigured()) {
    throw new Error("SMTP email is not configured.");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user || config.password ? { user: config.user, pass: config.password } : undefined,
  });

  await transporter.sendMail({
    from: config.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
