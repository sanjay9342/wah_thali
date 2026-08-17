# Deployment

Target deployment:

- Vercel for Next.js
- Supabase for PostgreSQL/auth/storage
- VPS-hosted n8n for automation
- Client-owned domain and Meta/Razorpay accounts

Before production:

1. Set all `.env.example` values in Vercel or Netlify.
2. Run database migrations.
3. Verify Meta webhook challenge.
4. Verify Razorpay test payment.
5. Confirm no secret values appear in browser bundles or admin responses.

## Domain

Production domain: `https://wahthali.in`

Set `NEXT_PUBLIC_SITE_URL=https://wahthali.in` in the hosting provider environment variables.

Add both domains in the hosting provider dashboard:

- `wahthali.in`
- `www.wahthali.in`

Then update DNS at the domain provider to the exact records shown by the hosting provider. Current public DNS resolves `wahthali.in` to `160.153.0.146` and `www.wahthali.in` to `wahthali.in`; if the site is deployed on Vercel or Netlify, replace those with that provider's required A/CNAME records.

Use these production webhook URLs:

- `https://wahthali.in/api/webhooks/razorpay`
- `https://wahthali.in/api/webhooks/meta`
- `https://wahthali.in/api/webhooks/n8n`

## Health Check

After every deployment, open:

`https://wahthali.in/api/health`

The response should show `"ok": true`. If it is false, check the failing section:

- `database.ok` false means `DATABASE_URL` is missing or cannot connect.
- `supabase.ok` false means `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing.
- `domain.ok` false means `NEXT_PUBLIC_SITE_URL` does not match the live host.

Do not put secret values in source code. Set them only in the hosting provider environment variables.

For database connection, set at least one of these in the deployed site's environment variables:

- `DATABASE_URL` preferred for runtime
- `DIRECT_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `SUPABASE_DB_URL`

If login shows a database unavailable message on `https://wahthali.in`, the deployed host is missing these variables or the latest code has not been redeployed.
