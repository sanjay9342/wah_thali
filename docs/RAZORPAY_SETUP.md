# Razorpay Setup

Required values:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Implemented endpoints:

- `POST /api/orders` creates a COD order or a Razorpay-backed `PENDING_PAYMENT` order.
- `POST /api/payments/razorpay` verifies `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`.
- `POST /api/webhooks/razorpay` verifies `X-Razorpay-Signature` against the raw request body and reconciles payment events.

Razorpay flow:

1. Cart submits server-priced order data to `/api/orders` with `paymentMethod: "RAZORPAY"`.
2. Server creates a Razorpay Order using the Orders API.
3. Browser opens Razorpay Checkout using the server-returned `keyId` and `orderId`.
4. Checkout handler posts the payment id, order id, signature, and local order number to `/api/payments/razorpay`.
5. Server verifies the HMAC signature and marks the local payment `PAID`.

Enable `onlinePaymentsEnabled` in admin settings before testing online payments.

Configure the Razorpay dashboard webhook URL as:

`{NEXT_PUBLIC_SITE_URL}/api/webhooks/razorpay`

Subscribe at minimum to:

- `payment.captured`
- `payment.authorized`
- `payment.failed`
