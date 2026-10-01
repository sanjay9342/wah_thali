# WhatsApp Orders API

Use this read-only API from a server-side WhatsApp chatbot or automation platform to retrieve orders and their customer details. It returns new orders and orders with status-history changes since a timestamp. It does not send WhatsApp messages itself; the chatbot or automation should poll this endpoint and send the appropriate messages.

## Configure

Set a long, random `WHATSAPP_ORDERS_API_KEY` in the production environment. Keep it secret and store it in the chatbot/automation platform's server-side credentials. Do not put it in browser code or a public URL.

## Endpoint

```http
GET {NEXT_PUBLIC_SITE_URL}/api/integrations/whatsapp/orders
Authorization: Bearer YOUR_WHATSAPP_ORDERS_API_KEY
```

Optional query parameters:

- `since`: ISO 8601 timestamp. Returns orders created after this time or with a status-history entry created after this time. Omit it to read all orders, in pages.
- `limit`: number of orders per page, from 1 to 100; defaults to 50.
- `cursor`: the `nextCursor` returned by the previous page. Pass the same `since` and `limit` while continuing that page sequence.

Example:

```http
GET https://wahthali.in/api/integrations/whatsapp/orders?since=2026-10-01T10%3A00%3A00.000Z&limit=50
Authorization: Bearer YOUR_WHATSAPP_ORDERS_API_KEY
```

The JSON response contains `orders`, `hasMore`, `nextCursor`, and `serverTime`. Each order includes its customer profile/contact and WhatsApp marketing preferences, saved addresses and tags, order items and totals, payment status, and full status timeline. Checkout address, receiver, location, and customer-note values currently live in the initial timeline note. Password hashes and payment-provider credentials are not returned.

## Polling

Poll on a short interval appropriate for your chatbot. On the first request, save the response's `serverTime` as a checkpoint. If `hasMore` is true, request subsequent pages using `nextCursor` and the same `since`; after all pages are processed, save the first page's `serverTime` as the next checkpoint. On later polls, send that saved value as `since`. This returns a full order record again when its status changes, so compare timeline entries or the current `status` to decide which WhatsApp notification to send. Handle a repeated order idempotently in your chatbot because polling can return the same order again if you retry a request.

Responses containing customer personal information must be handled securely and retained only as needed. The endpoint returns `401` for a missing/invalid key and `503` if the key or database is not configured.
