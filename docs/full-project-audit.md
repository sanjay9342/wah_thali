# Wah Thali Full Project Audit

Date: 2026-07-24

## Project Snapshot

- Framework: Next.js 16.2.11, App Router.
- Language: TypeScript with React 19.
- Styling: Tailwind CSS 4 utility classes in App Router components.
- Database: Prisma 7.9 with PostgreSQL/Supabase pooler.
- Supabase: server-only admin client exists in `src/lib/supabase.ts`.
- Auth: no complete Supabase Auth flow or protected admin/customer sessions yet.
- Cart: browser local storage cart; server-backed cart tables exist but are not fully wired.
- Deployment: `netlify.toml` runs Prisma generate and Next build.
- Homepage: approved homepage is in `src/components/menu-experience.tsx`; current visual design must be preserved.

## Route Audit

| Route | Present status | Data source | Problems | Required fix | Priority | Completion status |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Present, approved design | Supabase products/categories with fallback | Cart is local; offer slider is static; fallback data can mask DB failures | Preserve design; keep DB products/categories; connect offers/cart to server | High | Partial |
| `/menu` | Present, same experience as home | Supabase products/categories with fallback | Same as homepage; no product details/add-on modal | Add full product selection and server cart persistence | High | Partial |
| `/cart` | Present | Now receives Supabase products/coupons; local cart state | No server cart persistence; guest/auth merge missing; checkout link only | Add server-backed cart, availability revalidation, checkout handoff | High | Partial |
| `/checkout` | Present | Static form plus business constants | Demo wording; does not submit real order; address/payment not validated | Implement real form, serviceability, COD order creation, Razorpay when configured | Critical | Not complete |
| `/orders` | Present | Hardcoded active/past orders | Shows demo `WT-10021`; no authenticated customer scope | Load current user's/guest-token orders from DB | Critical | Not complete |
| `/offers` | Present | Static offers plus local coupon fallback | Not DB campaign-driven; copy buttons decorative | Load active coupons/promotions from DB and wire copy/apply actions | Medium | Partial |
| `/account` | Present | Hardcoded profile | Demo name/phone/stats; no auth or profile edit | Supabase Auth, profile, addresses, orders, logout | Critical | Not complete |
| `/wishlist` | Present | Static/simple page | Not connected to favorites table | Add real favorites per user/session | Medium | Not complete |
| `/support` | Present | Static cards | Demo order link; no ticket creation | Add support ticket creation and order lookup | Medium | Not complete |
| `/corporate` | Present | Static/simple page | Lead capture not persisted | Connect to leads table | Medium | Not complete |
| `/loyalty` | Present | Static/simple page | Loyalty values not real | Load loyalty account and transactions | Medium | Not complete |
| `/subscriptions` | Present | Static/simple page | Subscription flow not persisted | Add subscription/lead/order path if business approves | Low | Not complete |
| `/privacy-policy` | Present | Business/legal content | Needs final client legal review | Keep content consistent with business settings | Medium | Partial |
| `/terms-and-conditions` | Present | Business/legal content | Needs final client legal review | Keep fees, cancellation, GST consistent | Medium | Partial |
| `/refund-cancellation-policy` | Present | Business/legal content | Needs final client legal review | Keep refund/order cancellation logic aligned | Medium | Partial |
| `/delivery-policy` | Present | Business/legal content | Needs final client legal review | Keep delivery slabs and PINs aligned with checkout | Medium | Partial |
| `/order/WT-10021/confirmed` | Present | Static demo route | Predictable demo route; not real order success | Replace with dynamic order success route using secure token/order ownership | Critical | Not complete |
| `/order/WT-10021/track` | Present | Static demo route | Predictable demo tracking route | Replace with dynamic authorized tracking | Critical | Not complete |
| `/order/WT-10021/invoice` | Present | Static invoice | Not tied to real order/payment | Generate invoice from DB order by authorized access | High | Partial |
| `/admin` | Present | Mixed DB + hardcoded dashboard | No auth; metrics hardcoded | Protect route; calculate real aggregates | Critical | Partial |
| `/admin/orders` | Present | DB orders with demo fallback | No auth; demo fallback; buttons do not call PATCH | Protect; live status board; enforce server transitions | Critical | Partial |
| `/admin/inventory` | Present | DB products/categories; hardcoded stock overlay | No auth; edit controls decorative | Protect; product CRUD; stock updates; Supabase image upload | Critical | Partial |
| `/admin/coupons` | Present | DB coupons + static campaigns | No auth; static usage metrics; form decorative | Protect; coupon CRUD and usage analytics | High | Partial |
| `/admin/customers` | Present | DB customers with demo fallback | No auth; hardcoded summary metrics | Protect; real CRM aggregates and customer detail | High | Partial |
| `/admin/settings` | Present | DB settings read | No auth; form not wired; secrets not managed | Protect; validated settings update action | High | Partial |
| `/api/products` | Present | Prisma/Supabase | No admin auth; limited validation | Add role authorization, update/delete endpoints | Critical | Partial |
| `/api/coupons` | Present | Prisma/Supabase | No admin auth; no usage limits/product restrictions | Add auth, richer schema, server validation | High | Partial |
| `/api/orders` | Present | Prisma/Supabase | Previously trusted browser totals; no auth/guest tokens | Server-side price/coupon/stock validation added; still needs address/payment | Critical | Partial |
| `/api/orders/[orderNumber]` | Present | Prisma/Supabase | No customer/admin authorization | Add role/customer/guest-token checks | Critical | Partial |
| `/api/customers` | Present | Prisma/Supabase | No admin auth | Protect and limit PII by role | Critical | Not complete |
| `/api/settings` | Present | Prisma/Supabase | No admin auth; accepts arbitrary keys | Protect and validate allowed settings | High | Partial |
| `/api/storage/signed-upload` | Present | Supabase storage | Needs bucket and admin authorization | Create bucket, add auth/role checks | High | Partial |
| `/api/payments/razorpay` | Present | Server secret if configured | Verification only; no order/payment reconciliation | Create Razorpay order, verify webhook, idempotency | High | Partial |
| `/api/webhooks/meta` | Present | Env-gated | Needs template/config flow and signature hardening | Keep optional, add safe retries and audit | Medium | Partial |
| `/api/webhooks/n8n` | Present | Shared secret | Needs clear event contract | Keep optional, validate actions and audit | Medium | Partial |
| `/api/reports/gstr1` | Present | Prisma/Supabase | No admin auth | Protect and add date filters | High | Partial |

## Critical Findings

- Admin routes are public and must be protected before production use.
- Customer auth is not implemented, so profile/orders/address data cannot be safely scoped.
- Checkout is still a visual form and does not place a real validated order.
- `/orders`, `/account`, and fixed `/order/WT-10021/*` routes still contain demo customer/order data.
- Existing Prisma schema supports many operational tables but does not yet match the complete requested production model.
- No Supabase RLS policy files/migrations are present in the repository.
- API routes validate payload shape with Zod but mostly lack authorization and rate limiting.
- Cart is stored in localStorage; this is acceptable for a guest draft but not enough for authenticated persistence or server checkout.
- Supabase Storage requires the `wah-thali-assets` bucket to exist before image upload can work.
- Razorpay/WhatsApp/SMTP/n8n are optional and safely env-gated, but end-to-end production workflows are not complete.

## Completed During This Pass

- Supabase/Postgres connection was configured locally.
- Prisma schema was pushed to Supabase.
- Starter menu/categories/coupons/settings were seeded.
- Previously seeded demo customer and demo order were removed from Supabase.
- `prisma/seed.js` now only seeds demo customer/order when `WAH_SEED_DEMO_DATA=true`.
- Cart no longer auto-creates fake starter items.
- Cart page now receives products and coupons from Supabase-backed server loaders.
- `/api/orders` now recalculates product prices, coupon discount, GST, delivery, and stock from the database before creating an order.

## Next Priority List

1. Add Supabase Auth helpers, profile creation, and first-admin bootstrap documentation.
2. Protect all `/admin` pages and admin API mutations with server-side role checks.
3. Replace checkout demo screen with a working COD order form using `/api/orders`.
4. Replace `/orders`, `/account`, tracking, and invoice routes with real authorized database data.
5. Complete admin CRUD for products, inventory, coupons, customers, and settings.
6. Add RLS SQL policies and document how to apply them safely in Supabase.
7. Add end-to-end tests for customer order and admin status workflow.
