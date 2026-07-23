# n8n Setup

Set `N8N_SHARED_SECRET` in production.

n8n must sign webhook request bodies with:

`x-wah-signature = HMAC_SHA256(rawBody, N8N_SHARED_SECRET)`

Route:

`POST {NEXT_PUBLIC_SITE_URL}/api/webhooks/n8n`

Planned event triggers:

- Order created
- Order status changed
- Payment changed
- Cart abandoned
- Review eligible
- Subscription renewal
- Corporate lead created
- Complaint escalated
