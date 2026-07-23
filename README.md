# Wah Thali Platform

Production-shaped Next.js foundation for Wah Thali: customer ordering, cart pricing, checkout, tracking, admin CRM/operations, integration adapters, Prisma schema, and handover docs.

## Current Stack

- Next.js App Router, React, TypeScript strict mode
- Tailwind CSS v4 brand tokens
- Zod validation, Lucide icons, Recharts-ready dashboard dependency
- Prisma schema for PostgreSQL/Supabase
- Vitest unit tests for business rules

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Implemented Routes

- `/` customer homepage
- `/menu` searchable menu with filters and food cards
- `/cart` editable cart with coupon, GST, delivery, packaging, and free-delivery progress
- `/checkout` address, schedule, payment, COD flow
- `/order/WT-10021/confirmed`
- `/order/WT-10021/track`
- `/admin`
- `/admin/orders`
- `/admin/customers`
- `/admin/settings`
- `/api/webhooks/meta`
- `/api/webhooks/n8n`
- `/api/payments/razorpay`

## Next Credentials Needed

Copy `.env.example` to `.env.local` and fill Supabase, Razorpay, Meta WhatsApp, n8n, Google Maps, and SMTP values when ready. No secrets are committed.
