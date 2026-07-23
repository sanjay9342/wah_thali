# Meta WhatsApp Setup

Required values:

- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_VERIFY_TOKEN`

Configure the Meta webhook URL as:

`{NEXT_PUBLIC_SITE_URL}/api/webhooks/meta`

Implemented:

- Verification challenge route
- Incoming event intake route
- Test-mode response when persistence is not connected

Production completion:

- Store incoming and outgoing messages in `WhatsAppMessage`
- Persist `WebhookEvent` with duplicate protection
- Add template send adapter
- Add opt-in/opt-out enforcement
- Add retry and human handover queues
