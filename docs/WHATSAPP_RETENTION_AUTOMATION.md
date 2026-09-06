# WhatsApp Retention Automation

The Wah Thali WhatsApp follow-up strategy does not require n8n.

Admin page:

`/admin/automation`

What happens automatically:

1. Customer opts in during checkout.
2. Admin marks the order as delivered.
3. The system counts completed delivered orders.
4. Any old active campaign for that customer is cancelled.
5. A new first-order, second-order, or loyal journey is scheduled.
6. A cron call processes due WhatsApp template messages.
7. STOP replies opt the customer out and cancel campaigns.
8. Problem feedback opens a support ticket and pauses marketing.

Required scheduler:

Set `CRON_SECRET` in production.

Call every 15 minutes:

`GET {NEXT_PUBLIC_SITE_URL}/api/cron/whatsapp-retention?action=process_due`

Header:

`Authorization: Bearer {CRON_SECRET}`

Call once daily around 10:45 AM IST:

`GET {NEXT_PUBLIC_SITE_URL}/api/cron/whatsapp-retention?action=schedule_dormant`

Header:

`Authorization: Bearer {CRON_SECRET}`

Manual testing:

Use the buttons on `/admin/automation`:

- Seed templates
- Send test on a single template
- Test all templates
- Process due now
- Check dormant

Template testing is sent only to the mobile number entered in the Test mobile number field. Do not use a customer number there unless you want that customer to receive test messages.

Safe test checklist:

1. Open `/admin/automation`.
2. Save the automation settings once so the configured coupons are synced to `/admin/coupons`.
3. Enter your own WhatsApp number in Test mobile number.
4. Click Seed templates. The template table should fill with approved template names.
5. Click Send test on one template. You should receive one WhatsApp template message.
6. Click Test all templates only after the single template succeeds. The page reports sent and failed counts.
7. Click Process due now only when you are ready to send real queued customer messages. This button asks for confirmation.
8. Click Check dormant only when you are ready to schedule dormant customer journeys. This button asks for confirmation.

Duplicate delivered-order safety:

- Normal admin order updates cannot move an order from `DELIVERED` to `DELIVERED` again.
- The retention scheduler also checks whether the delivered order already has an active or completed retention campaign with non-cancelled messages.
- If the same delivered order is retried by webhook/manual automation, it returns the existing campaign instead of creating duplicate customer messages.

Feedback button troubleshooting:

- `Loved it` sends an immediate Google review reply and records a review-request message.
- `It was good` sends an immediate thank-you reply.
- `Something wasn't right` opens a support ticket, cancels active marketing, and sends an immediate apology reply.
- If the customer taps a WhatsApp button and no reply arrives, check Meta WhatsApp webhook delivery for `POST /api/webhooks/meta`.
- Keep `META_WHATSAPP_ACCESS_TOKEN` on one single line in `.env.local` and production environment variables.

n8n is optional. If you use n8n later, it can call the same logic through `/api/webhooks/n8n`, but the built-in cron endpoint is simpler.
