---
phase: 11
slug: capture-infrastructure
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-30
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **TypeScript check** | `cd sidecar && npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose` + `cd sidecar && npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green + tsc clean
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 11-01-01 | 01 | 1 | CAPI-02 | compile | `cd sidecar && npx tsc --noEmit` | pending |
| 11-01-02 | 01 | 1 | CAPI-01, CAPI-03 | compile + regression | `npx vitest run --reporter=verbose && cd sidecar && npx tsc --noEmit` | pending |
| 11-02-01 | 02 | 2 | CAPI-01, CAPI-02, CAPI-03, CAPI-04 | manual runtime | checkpoint:human-verify | pending |

*Status: pending / green / red / flaky*

**Note:** CAPI behaviors are runtime/integration behaviors — they require the sidecar to be running. They cannot be unit-tested with vitest. All four success criteria are verified manually in Plan 02. Plan 01 tasks use vitest (regression) + tsc --noEmit (compilation of new code) as automated verification.

---

## Wave 0 Requirements

None — no new vitest test files needed for Phase 11. All CAPI behaviors are runtime-only and verified via Plan 02 human checkpoint. Existing vitest suite + TypeScript compilation provide regression and correctness coverage for Plan 01.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Discovery file deleted on app close | CAPI-04 | Requires full app lifecycle | Start app -> verify api.port exists -> close app -> verify api.port absent |
| curl auth rejection | CAPI-03 | E2E validation | `curl http://localhost:{port}/health` -> 401; `curl -H "Authorization: Bearer {token}" http://localhost:{port}/health` -> 200 |
| HTTP + WS on same port | CAPI-01 | Requires running server | Verify curl and terminal both work on same port |
| Discovery file written on startup | CAPI-02 | Requires running sidecar | `Test-Path $env:APPDATA\chat-overlay-widget\api.port` -> True |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (vitest + tsc for Plan 01, checkpoint echo for Plan 02)
- [x] Sampling continuity: tsc --noEmit added to both Plan 01 task verify blocks
- [x] Wave 0 not needed — all CAPI behaviors are runtime-verified in Plan 02
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
