# Database

The Prisma schema includes users, roles, permissions, customers, addresses, leads, categories, products, cart, orders, payments, coupons, loyalty, support, reviews, WhatsApp messages, automation rules, settings, integrations, audit logs, webhook events, and idempotency keys.

Recommended setup:

1. Create a Supabase PostgreSQL project.
2. Set `DATABASE_URL` in `.env.local`.
3. Run Prisma migrations after reviewing `prisma/schema.prisma`.
4. Keep Supabase service role keys server-only.

Important indexes are included for phone, email, status, dates, order number, payment IDs, webhook event IDs, and common admin filters.
