# Razorpay Setup

Required values:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

The verification endpoint is:

`POST /api/payments/razorpay`

It validates `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`. If the secret is missing, the endpoint responds in test-adapter mode instead of pretending payment is verified.
