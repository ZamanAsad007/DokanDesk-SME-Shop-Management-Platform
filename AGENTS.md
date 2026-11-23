# DokanDesk Repository Safety & Workflow Rules (MUST FOLLOW)

## 1. Git Workflow
- NEVER run `git push` unless the user explicitly says "push" in the current message.
- NEVER run `git add .`, `git add -A`, or `git commit -a`. Stage files by explicit path only.
- Before every commit: run `git status` and `git diff --cached --stat`, list staged files, and confirm none are secrets, `.env*`, keys, dumps, build output, or confidential design documents.
- NEVER force-push, rewrite history, or skip hooks (`--no-verify`) unless explicitly asked.
- If a pre-commit or secret-scan check fails, STOP and report it. Do not bypass it.
- Work on phase/feature branches (`feat/phase-X-...`), keep commits granular and atomic with conventional commit messages.

## 2. Secrets & Sensitive Data
- NEVER commit secrets: `.env*` (except `.env.example`), API keys, JWT secrets, DB passwords, SMTP/SMS keys, webhook secrets, private keys/certs (`*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`), service-account JSON, DB dumps.
- NO hardcoded secrets or fallback defaults (`process.env.JWT_SECRET || "secret"` is strictly forbidden). Missing env must crash the app on startup with a clear error.
- Generated keys/secrets must go to `.env` only (gitignored). Scripts must print nothing sensitive.
- `.env.example` has placeholders only (`JWT_SECRET=replace-me`).
- Docker: no secrets in `Dockerfile` (`ENV`/`ARG`); use `env_file` or `${VAR:?missing}`; `.dockerignore` excludes `.env*`.
- Tests/fixtures/seeds use fake values (`test-secret-not-real`, fake shops, fake people, masked numbers).
- NEVER log passwords, tokens, PINs, full phone numbers, or credentials.
- Production secrets live only in hosting provider dashboards, never in the repository.
- If a secret is found in the repo or history, stop immediately and notify the user to rotate it.

## 3. Code Quality & Invariants
- Every task ends with: lint passes, typecheck passes, relevant tests pass.
- Every endpoint is tenant-scoped and permission-guarded. No exceptions.
- Money is integer paisa (BigInt/number), never floating point. Quantities use decimal-safe handling.
- Never write raw SQL string concatenation; use Prisma or parameterized queries.
- Ledger, stock-movement, and audit tables are append-only. Fix mistakes with compensating rows.
- Do not add dependencies without stating why.

## 4. Data
- Fake data only: no real names, phone numbers, NID, bank, or card details.
