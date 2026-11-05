# Monthly goals and closing report implementation plan

> **For agentic workers:** Use executing-plans to implement the tasks. Independent goals and report work may proceed concurrently.

**Goal:** Continue the authorized monthly wealth improvements with scoped goals and a printable monthly closing report.

**Architecture:** Extend optional goal metadata in the existing portfolio JSON and reuse current account classification, wealth filters and monthly calculations. Generate reports from saved closings in the browser; no new services, dependencies or database migration.

**Tech Stack:** Next.js, React, TypeScript, PostgreSQL portfolio JSON, existing node tests.

## Design and constraints

- Goals can use total wealth, PF/PJ and bank together, or one specific account. Existing goals retain their meaning. Classification follows current account metadata, consistently with analytics.
- Goal progress and estimated date use only the selected scope, completed monthly records and actual calendar intervals. Missing balances or absent scope are unavailable, not zero.
- Reports select a saved month, reuse global PF/PJ and bank filters, compare to the most recent earlier completed closing, and clearly label drafts, incomplete data and non-consecutive comparisons.
- Include total/PF/PJ/bank balances, account breakdown, largest changes, investment result (explicitly not monthly return), relevant pending items and closing notes. Global monthly flow and notes are shown only unfiltered because they cannot be allocated to a bank or ownership type.
- Printing uses the browser's print/save PDF functionality and report-only print CSS; no uploads or external data processing.
- Existing architecture is preferable to a separate reporting service or storing redundant report snapshots: all results remain consistent with saved records and current account classification.
- Preserve authentication, dirty-form guards, current goals, monetary cent arithmetic and saved financial snapshots. No production fixture data.

## Review focus

- Legacy goals must keep account/total behavior and survive edits from older clients.
- Missing selected balances must not look like a zero or a reached goal.
- New/absent accounts cannot create fabricated investment returns.
- Previous month selection must be chronological even when input arrays are unsorted.
- Filtered reports must not attribute global cash flow or global notes to PF/PJ/bank.

## Task 1: Scoped goals

Files: lib/finance.ts, components/goals.tsx, app/goals.css, tests/goal-scope.test.ts.

- [x] Add and observe failing tests for PF/PJ+bank progress/forecast, legacy goals, validation and missing scope.
- [x] Extend Goal with optional ownership/bank filter metadata, validate operation and preserve omitted metadata on updates.
- [x] Add clear scope controls and labels, maintain account-specific mode and responsive form.
- [x] Run scoped and existing financial tests.

## Task 2: Closing report

Files: lib/monthly-report.ts, components/monthly-report.tsx, app/monthly-report.css, tests/monthly-report.test.ts.

- [x] Add and observe failing tests for scoped totals, missing values, draft vs prior closed, incomplete investment results, nonconsecutive dates and no mutation.
- [x] Implement monthlyReport(state,month,filter) using existing wealth helpers.
- [x] Implement MonthlyReport({state,month,filter,onOpen}) with readable PC/mobile/print layouts and a print button.
- [x] Run focused tests.

## Task 3: Integrate, review, publish

Files: components/portfolio-shell.tsx, components/history.tsx, app/layout.tsx or stylesheet imports, package.json, README.md.

- [x] Add Relatório mensal navigation, shared month/filter selection, and opening from history. Preserve dirty guards.
- [x] Include new test files in test command and document features.
- [x] Run full tests, typecheck and production build; review independently.
- [x] Check server rendering through a temporary fixture with no production writes; remove fixture. Browser automation was disabled in Work settings, so desktop/mobile/print visual checks remain unverified.
- [ ] Commit and publish through existing GitHub/EasyPanel workflow, then verify production asset and health.

## Verification record

- Baseline: 74 tests passed. Final domain suite: 94 tests passed.
- Typecheck passed. Production build passed; final build rerun after demo provenance correction.
- Temporary HTTP fixture: all, PJ+Nubank, empty scope, draft, absent month and goals rendered successfully. Fixture and local server removed.
- Independent review: goals/integration clean. One report issue corrected: demonstration notice is retained within printable report; SSR regression observed failing before fix and passing after for demo and real provenance.
