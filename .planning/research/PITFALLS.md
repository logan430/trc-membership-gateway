# Pitfalls Research

**Domain:** Community Intelligence Platform (Benchmarking, Resource Library, Gamification) on Production System
**Researched:** 2026-01-22
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Production Database Migration Causes Downtime

**What goes wrong:**
Running ALTER TABLE or CREATE INDEX on large tables locks the table for extended periods. A migration that takes 2 seconds in development might take 2 hours in production, causing complete application downtime for paying customers.

**Why it happens:**
Developers test migrations on empty development databases and blindly run them in production. PostgreSQL's default ALTER TABLE behavior rewrites the entire table. Creating indexes without CONCURRENTLY flag locks tables. Foreign key constraints added without NOT VALID cause full table scans.

**How to avoid:**
- **Use additive-only migrations** - Never drop columns, only add (mark old ones deprecated)
- **Create indexes concurrently** - Always use `CREATE INDEX CONCURRENTLY` in production
- **Add foreign keys in two steps** - First add with `NOT VALID`, then `VALIDATE CONSTRAINT` separately
- **Test on production-sized data** - Create staging database with realistic data volumes
- **Use expand-contract pattern** - Expand schema (add new), migrate data, contract (remove old)
- **Prepare rollback scripts** - Test rollback procedure before deployment
- **Schedule during low traffic** - Run during maintenance windows
- **Split migrations** - Break large migrations into smaller, independent changes

**Warning signs:**
- Migration runs for more than 10 seconds in development
- Table has more than 100K rows
- Adding non-nullable columns without defaults
- Creating indexes on large tables
- Adding foreign key constraints
- Database CPU spikes during migration testing

**Phase to address:**
Phase 1 (Database Schema Extension) - Establish migration patterns that all subsequent phases follow.

**Sources:**
- [Zero-Downtime Database Migration Guide](https://dev.to/ari-ghosh/zero-downtime-database-migration-the-definitive-guide-5672)
- [PostgreSQL Zero-Downtime Migrations](https://xata.io/blog/zero-downtime-schema-migrations-postgresql)
- [GoCardless: Zero-Downtime Postgres Migrations - The Hard Parts](https://gocardless.com/blog/zero-downtime-postgres-migrations-the-hard-parts/)

---
