# Meta WhatsApp Setup

Required values:

- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_VERIFY_TOKEN`
- `META_WHATSAPP_OTP_TEMPLATE_NAME`

Recommended values:

- `META_WHATSAPP_LANGUAGE_CODE` such as `en_US`
- `META_WHATSAPP_DEFAULT_COUNTRY_CODE`, default `91`
- `META_GRAPH_API_VERSION`, default `v23.0`

If the approved OTP template has a dynamic button parameter, also set:

- `META_WHATSAPP_OTP_BUTTON_SUB_TYPE`
- `META_WHATSAPP_OTP_BUTTON_INDEX`

Configure the Meta webhook URL as:

`{NEXT_PUBLIC_SITE_URL}/api/webhooks/meta`

Implemented:

- Verification challenge route
- Incoming event intake route
- Test-mode response when persistence is not connected
- Customer signup/signin OTP creation and verification
- WhatsApp Cloud API template send adapter for OTP
- Outbound OTP message id persistence in `WhatsAppMessage`
- Signup API requires OTP verification before creating a new customer

Production completion:

- Store incoming and outgoing messages in `WhatsAppMessage`
- Persist `WebhookEvent` with duplicate protection
- Add opt-in/opt-out enforcement
- Add retry and human handover queues

OTP template requirements:

- Create and approve a WhatsApp template in Meta Business Manager.
- The template body must accept the OTP as the first variable, for example `{{1}}`.
- If using a dynamic URL/copy-code button, configure the optional button env values above.
