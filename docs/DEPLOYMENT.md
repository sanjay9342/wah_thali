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

## GoDaddy Node.js Hosting Fix

The live `wahthali.in` deployment currently runs on GoDaddy Node.js Hosting. If `/api/health` shows every environment variable as `false`, the app was uploaded without production environment variables.

Open the GoDaddy Node.js Hosting app settings and add the same keys from local `.env.local` into the app's Environment Variables section, then redeploy/restart the app. Do not paste these values into `netlify.toml`, GitHub, or source files.

In the GoDaddy UI, enter each variable as a separate key/value row:

- Key: `DATABASE_URL`
- Value: paste only the connection string value, without `DATABASE_URL=`
- Do not add wrapping quotes in the GoDaddy value field.
- Do not add spaces before or after the key name.

Example format:

```txt
Key: DATABASE_URL
Value: postgresql://...
```

Minimum required values for login, registration, and WhatsApp OTP:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_VERIFY_TOKEN`
- `META_WHATSAPP_OTP_TEMPLATE_NAME`
- `META_WHATSAPP_LANGUAGE_CODE`
- `META_WHATSAPP_DEFAULT_COUNTRY_CODE`
- `META_GRAPH_API_VERSION`
- `META_WHATSAPP_OTP_BUTTON_SUB_TYPE`
- `META_WHATSAPP_OTP_BUTTON_INDEX`

For the current approved WhatsApp OTP template, these button values are required:

- `META_WHATSAPP_OTP_BUTTON_SUB_TYPE=url`
- `META_WHATSAPP_OTP_BUTTON_INDEX=0`

After redeploy/restart, `https://wahthali.in/api/health` must return `"ok": true`. If `database.configured` is still `false`, the host still has no `DATABASE_URL`.

If `database.configured` is `true` but `database.ok` is `false`, the app sees `DATABASE_URL` but cannot use it. Re-paste the `DATABASE_URL` and `DIRECT_URL` values from local `.env.local`, making sure the password, host, port, and query string are complete.

For database connection, set at least one of these in the deployed site's environment variables. The app tries them in this order:

- `DATABASE_URL`
- `DIRECT_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `SUPABASE_DB_URL`

On shared hosting, prefer the Supabase pooler URL in `DATABASE_URL` because direct Postgres port `5432` can be blocked. Keep `DIRECT_URL` for migration/admin tasks only if the host can connect to it.

If login shows a database unavailable message on `https://wahthali.in`, the deployed host is missing these variables or the latest code has not been redeployed.

For the first admin password login, set:

- `ADMIN_EMAILS`
- `ADMIN_MOBILES`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `ADMIN_BOOTSTRAP_NAME`

For WhatsApp OTP, set:

- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_OTP_TEMPLATE_NAME`
- `META_WHATSAPP_LANGUAGE_CODE`
- `META_WHATSAPP_DEFAULT_COUNTRY_CODE`

The app also accepts `WHATSAPP_OTP_TEMPLATE_NAME` or `META_WHATSAPP_TEMPLATE_NAME` as aliases for the OTP template name.

The OTP template must already exist and be approved in Meta WhatsApp Manager. It should be a WhatsApp authentication/OTP template whose body accepts the OTP code as the first variable. If the template has a copy-code or URL button variable, also set:

- `META_WHATSAPP_OTP_BUTTON_SUB_TYPE`
- `META_WHATSAPP_OTP_BUTTON_INDEX`
