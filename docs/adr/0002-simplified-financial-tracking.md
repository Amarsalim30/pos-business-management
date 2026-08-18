# ADR-0002: Simplified Financial Tracking Over Double-Entry Bookkeeping

**Status:** Accepted
**Date:** 2026-08-18
**Deciders:** Owner + Engineering

## Context

The original plan specified a full accounting system: chart of accounts, journal entries with debit/credit lines, trial balance — textbook double-entry bookkeeping (the kind QuickBooks or Sage provides).

The business owner needs to see: daily/weekly/monthly profit, petty cash tracking, bank balances, and outstanding customer/supplier balances.

## Decision

**Drop formal double-entry bookkeeping.** Replace with simplified financial tracking:
- Petty cash: simple in/out log
- Bank accounts: deposit/withdrawal records
- Profit: computed from existing sales, purchases, project, and Mpesa income data
- Recurring expenses (rent, payroll): fixed monthly amounts in store settings

Tables dropped: `chart_of_accounts`, `journal_entries`, `journal_lines`.

## Rationale

- A 2-3 store solar shop doesn't need formal accounting infrastructure for v1
- All the data the owner actually needs (profit, expenses, balances) is already captured by the sales, purchasing, and project modules
- Double-entry is the most complex module in the plan and delivers features the owner hasn't asked for (trial balance, balance sheet, income statement)
- If the business grows and needs a formal accountant, double-entry can be added later or data can be exported to a real accounting tool

## Consequences

- No formal trial balance, balance sheet, or income statement
- An accountant reviewing the books would need to use an external tool
- Profit calculations are "management accounting" (revenue minus costs) not "financial accounting" (formal GAAP/IFRS)
- Adding double-entry later would require building the journal system and backfilling historical entries
