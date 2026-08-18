# ADR-0001: Local-First Single-Store Architecture for V1

**Status:** Accepted
**Date:** 2026-08-18
**Deciders:** Owner + Engineering

## Context

The system replaces a legacy VB6 POS. The business has 2-3 physical stores that experience intermittent internet connectivity. The owner wants store data isolation for better management and separation.

Three approaches were considered:
1. **DB-per-store with sync** — each store has a local PostgreSQL, a central server aggregates for the owner dashboard
2. **Single central DB with row-level tenancy** — one PostgreSQL instance, `store_id` on every row
3. **Hybrid local + cloud** — local DBs for offline, cloud for aggregation

## Decision

**V1 ships as a single-store system.** One local PostgreSQL instance per store. The owner dashboard reads from the same local DB. No sync service, no central server, no multi-store coordination.

Multi-store sync (push-based, one-directional from stores to a central DB on one store machine) is deferred to a future phase. The `store_id` foreign key is kept in the schema so the data model is multi-store-ready.

## Rationale

- The offline requirement rules out a pure central-DB approach
- Building sync infrastructure before validating the core POS is premature
- A single-store system is dramatically simpler to build, test, and deploy
- The schema stays multi-store-ready (store_id FK) so expansion doesn't require a rewrite

## Consequences

- The owner can only see data for the store they're physically at (until sync is built)
- Cross-store reporting is not available in v1
- When multi-store sync is added, it will be push-based (stores → central) to avoid conflict resolution complexity
