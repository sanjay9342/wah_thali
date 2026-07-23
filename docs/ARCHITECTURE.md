# Architecture

Wah Thali is organized as a Next.js App Router application with server-first pages, client islands for interactive cart behavior, typed business rules in `src/lib`, and integration boundaries under `src/app/api`.

The intended production database is PostgreSQL through Supabase, modeled in `prisma/schema.prisma`. Runtime business values such as fees, delivery thresholds, support contacts, payment modes, and feature flags should be stored in `BusinessSetting` and edited from `/admin/settings`.

External systems are isolated behind adapters/routes:

- Meta WhatsApp Cloud API: `/api/webhooks/meta`
- n8n signed automation webhooks: `/api/webhooks/n8n`
- Razorpay verification: `/api/payments/razorpay`

Every production webhook should persist a `WebhookEvent`, check duplicate provider event IDs, write an `AuditLog`, and avoid returning secret values to the browser.
