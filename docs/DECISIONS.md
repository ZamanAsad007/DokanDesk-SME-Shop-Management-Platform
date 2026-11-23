# Architectural Decision Records (ADR) - DokanDesk

This log tracks architectural and design decisions made throughout the evolution of the DokanDesk platform.

---

## ADR 001: Monorepo Architecture with Modular Monolith Backend

### Status
Accepted

### Context
DokanDesk is an SME platform supporting POS, multi-branch inventory, dues, purchasing, and reporting. To ensure high developer velocity, shared type safety, atomic commits, and realistic delivery within the target timeframe, architectural complexity must be tightly controlled.

### Decision
- Use a **pnpm workspaces monorepo** containing:
  - `apps/api`: NestJS modular monolith backend
  - `apps/web`: React + Vite frontend
  - `packages/shared`: Shared Zod schemas, TypeScript types, permission constants, and money helpers
- Keep all domain modules (`auth`, `tenants`, `catalog`, `inventory`, `purchasing`, `sales`, `customers`, `accounts`, `reports`, `notifications`) inside a single modular monolith with strict boundary interfaces and domain events.

### Consequences
- Shared validation and types between backend and frontend without code duplication.
- Single deployment target for the API; no distributed system network overhead or saga complexity.

---

## ADR 002: Tenant Isolation Strategy

### Status
Accepted

### Context
DokanDesk is a multi-tenant SaaS. A critical security requirement is that a user from Tenant A must never be able to view, query, or mutate Tenant B's data under any circumstance.

### Decision
- Store `tenant_id` on every tenant-scoped entity.
- Enforce tenancy at the data-access layer via Prisma Client Extensions (`$extends`) and request-scoped `AsyncLocalStorage` tenant context.
- Automatic injection of `tenant_id` on queries (`where: { tenant_id }`) and mutations (`data: { tenant_id }`).
- Implement an automated cross-tenant test harness running against all API routes to continuously verify tenant isolation.

### Consequences
- Prevents accidental omission of tenant filters in controllers or services.
- Simplifies query logic while maintaining zero-leakage security guarantees.

---

## ADR 003: Financial Values as Integer Paisa

### Status
Accepted

### Context
JavaScript floating-point arithmetic (IEEE 754) introduces rounding inaccuracies (e.g. `0.1 + 0.2 !== 0.3`). Financial discrepancies in POS, cart calculations, and dues ledgers are intolerable.

### Decision
- Store and calculate all monetary amounts as **integer paisa** (1 BDT = 100 paisa) using integer / BigInt types.
- Never store or perform arithmetic with floating-point currency.
- Format to decimal strings only at the presentation layer (e.g., UI display or formatted PDF invoices).

### Consequences
- Exact arithmetic across sales, taxes, discounts, and split payments.
- Zero floating-point rounding drift.

---

## ADR 004: Append-Only Ledgers for Inventory and Financial Tracking

### Status
Accepted

### Context
Stock balances, customer credit dues (baki), and cash accounts must have an immutable, verifiable audit trail. Direct updates (`UPDATE stock SET qty = ...`) destroy historical traceability.

### Decision
- Stock movements (`stock_movements`), customer credit transactions (`customer_ledger`), and supplier transactions (`supplier_ledger`) are strictly **append-only**.
- Cached summary balances (such as `stock_levels` or customer balance) are updated in the same database transaction as ledger entry insertion.
- Erroneous entries are rectified through compensating rows linked to the original transaction, never in-place row edits.
- Reconciliation background jobs verify cached levels against the sum of movements.

### Consequences
- Complete traceability and auditability.
- Invariant guarantees verifiable via unit and property tests.
