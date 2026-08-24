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

Order notification templates:

- `META_WHATSAPP_ORDER_STATUS_TEMPLATE_NAME` can be used as the shared fallback template.
- `META_WHATSAPP_ORDER_NEW_TEMPLATE_NAME` is optional if order placed uses a different template from the shared status template.
- `META_WHATSAPP_ORDER_DELIVERED_TEMPLATE_NAME` is optional for delivered messages.
- `META_WHATSAPP_ORDER_DECLINED_TEMPLATE_NAME` is recommended for restaurant-declined messages and should include the decline reason parameter.
- `META_WHATSAPP_ORDER_CANCELLED_TEMPLATE_NAME` is used when the customer cancels their own order before restaurant acceptance.
- `META_WHATSAPP_OWNER_ORDER_TEMPLATE_NAME` is optional for owner/admin alerts to the WhatsApp number saved in admin settings.
- `META_WHATSAPP_OWNER_ORDER_NEW_TEMPLATE_NAME` and `META_WHATSAPP_OWNER_ORDER_CANCELLED_TEMPLATE_NAME` can override the shared owner alert template for new and cancelled orders.

Short placed/delivered order template body parameters:

1. Customer name
2. Order number
3. Item summary
4. Total bill
5. Tracking URL

Declined order template body parameters:

1. Customer name
2. Order number
3. Decline reason
4. Item summary
5. Total bill
6. Tracking URL

Customer cancelled order template body parameters:

1. Customer name
2. Order number
3. Item summary
4. Total bill
5. Tracking URL

Owner/admin order alert template body parameters:

1. Wah Thali
2. Order number
3. Alert type
4. Customer/items summary
5. Total bill
6. Note
7. Tracking URL

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
