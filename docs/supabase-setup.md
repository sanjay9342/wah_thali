# Supabase Setup

1. Create a Supabase project.
2. Copy the project Postgres connection string into `DATABASE_URL`.
3. Copy the direct Postgres connection string into `DIRECT_URL`.
4. Copy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
5. Create a storage bucket named `wah-thali-assets`.
6. Run:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

For Netlify, add the same environment variables in Site configuration > Environment variables.
