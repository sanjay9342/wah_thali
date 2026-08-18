import "server-only";

import { readServerEnv } from "@/lib/server-env";

type WhatsAppSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; status?: number; message: string };

function readEnv(key: string) {
  return readServerEnv(key);
}

function readFirstEnv(keys: string[]) {
  for (const key of keys) {
    const value = readEnv(key);
    if (value) return value;
  }

  return "";
}

export function getWhatsAppOtpConfigStatus() {
  const missing = [
    readServerEnv("META_WHATSAPP_PHONE_NUMBER_ID", ["WHATSAPP_PHONE_NUMBER_ID", "META_PHONE_NUMBER_ID"]) ? "" : "META_WHATSAPP_PHONE_NUMBER_ID",
    readEnv("META_WHATSAPP_ACCESS_TOKEN") ? "" : "META_WHATSAPP_ACCESS_TOKEN",
    readFirstEnv(["META_WHATSAPP_OTP_TEMPLATE_NAME", "WHATSAPP_OTP_TEMPLATE_NAME", "META_WHATSAPP_TEMPLATE_NAME"])
      ? ""
      : "META_WHATSAPP_OTP_TEMPLATE_NAME",
  ].filter(Boolean);
  return { configured: missing.length === 0, missing };
}

function toWhatsAppPhone(mobile: string) {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length > 10) return digits;

  const countryCode = readServerEnv("META_WHATSAPP_DEFAULT_COUNTRY_CODE", ["WHATSAPP_DEFAULT_COUNTRY_CODE"]) || "91";
  return `${countryCode.replace(/\D/g, "")}${digits.slice(-10)}`;
}

function getTemplateComponents(code: string) {
  const components: Array<Record<string, unknown>> = [
    {
      type: "body",
      parameters: [{ type: "text", text: code }],
    },
  ];

  const buttonSubType = readServerEnv("META_WHATSAPP_OTP_BUTTON_SUB_TYPE", ["WHATSAPP_OTP_BUTTON_SUB_TYPE"]);
  if (buttonSubType) {
    components.push({
      type: "button",
      sub_type: buttonSubType,
      index: readServerEnv("META_WHATSAPP_OTP_BUTTON_INDEX", ["WHATSAPP_OTP_BUTTON_INDEX"]) || "0",
      parameters: [{ type: "text", text: code }],
    });
  }

  return components;
}

export async function sendWhatsAppOtp(mobile: string, code: string): Promise<WhatsAppSendResult> {
  const status = getWhatsAppOtpConfigStatus();
  if (!status.configured) {
    return {
      ok: false,
      message: `WhatsApp OTP is not configured. Missing: ${status.missing.join(", ")}`,
    };
  }

  const graphApiVersion = readEnv("META_GRAPH_API_VERSION") || "v23.0";
  const phoneNumberId = readServerEnv("META_WHATSAPP_PHONE_NUMBER_ID", ["WHATSAPP_PHONE_NUMBER_ID", "META_PHONE_NUMBER_ID"]);
  const accessToken = readEnv("META_WHATSAPP_ACCESS_TOKEN");
  const templateName = readFirstEnv(["META_WHATSAPP_OTP_TEMPLATE_NAME", "WHATSAPP_OTP_TEMPLATE_NAME", "META_WHATSAPP_TEMPLATE_NAME"]);
  const languageCode = readEnv("META_WHATSAPP_LANGUAGE_CODE") || "en_US";
  const endpoint = `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toWhatsAppPhone(mobile),
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: getTemplateComponents(code),
      },
    }),
  });

  const data = await response.json().catch(() => null) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: data?.error?.message || "Meta WhatsApp Cloud API rejected the OTP message.",
    };
  }

  return { ok: true, messageId: data?.messages?.[0]?.id };
}
