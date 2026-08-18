# ADR-0003: Unified Pre-Sale Documents Table

**Status:** Accepted
**Date:** 2026-08-18
**Deciders:** Owner + Engineering

## Context

The original plan had three separate document types with separate tables: Quotations, Proforma Invoices, and Sales. Quotations and proformas had nearly identical schemas, and the business wanted flexible conversion between them.

## Decision

**Merge quotations and proforma invoices into a single `pre_sale_documents` table** with a `type` field (`quotation` | `proforma`).

Conversion paths supported:
- Quotation → Sale
- Proforma → Sale
- Quotation → Proforma (type change)
- Direct Sale (skip pre-sale entirely)

## Rationale

- The two document types have identical fields (customer, items, totals, dates, status)
- A single table eliminates duplicate schemas, models, routers, and conversion logic
- The `type` field preserves the business distinction without architectural duplication
- Conversion between quotation and proforma becomes a simple field update instead of a cross-table copy

## Consequences

- One set of endpoints (`/api/v1/pre-sales/`) instead of two (`/quotations/` + `/profoma/`)
- Frontend has one form component with a type selector instead of two near-identical pages
- If quotations and proformas diverge in structure later (e.g., proformas get approval workflows), a migration may be needed
