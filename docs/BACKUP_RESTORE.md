# Backup And Restore

Use Supabase scheduled backups for PostgreSQL. Before major schema releases, create a manual backup and record the migration hash.

Restore rehearsal should verify:

- Customers, orders, payments, invoices, and audit logs
- WhatsApp message history
- Business settings and integration configuration
- Admin access after restore
