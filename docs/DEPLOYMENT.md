# Deployment

Target deployment:

- Vercel for Next.js
- Supabase for PostgreSQL/auth/storage
- VPS-hosted n8n for automation
- Client-owned domain and Meta/Razorpay accounts

Before production:

1. Set all `.env.example` values in Vercel.
2. Run database migrations.
3. Verify Meta webhook challenge.
4. Verify Razorpay test payment.
5. Confirm no secret values appear in browser bundles or admin responses.
