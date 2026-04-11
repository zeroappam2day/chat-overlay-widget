---
phase: 39
slug: overlay-lifecycle-target-binding
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-11
---

# Phase 39 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| WebSocket to frontend store | Walkthrough step events arrive from sidecar via WebSocket | Step objects (stepId, title, instruction) |
| MCP tool input to sidecar | targetHwnd arrives from MCP tool call (Claude Code) | Integer (Windows HWND) |
| HTTP POST body to walkthroughEngine | targetHwnd parsed by WalkthroughSchema | Integer validated by Zod |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-39-01 | Spoofing | annotationBridgeStore.setWalkthroughStep | accept | Input from local WebSocket only (single-user desktop app). Feature flag gates handler. | closed |
| T-39-02 | Denial of Service | showOverlay/hideOverlay rapid calls | accept | Tauri show/hide are idempotent; rapid events produce harmless redundant IPC. Single-user local app. | closed |
| T-39-03 | Tampering | targetHwnd value | accept | targetHwnd stored only, not acted upon in Phase 39. Zod validates positive integer. Phase 40+ adds action validation. | closed |
| T-39-04 | Information Disclosure | targetHwnd in walkthrough state | accept | HWND is a Windows kernel handle integer. Same-process exposure has no security implications. Single-user local app. | closed |
| T-39-05 | Spoofing | Arbitrary HWND from MCP caller | accept | MCP callers are trusted (Claude Code running locally). HWND validity not checked in Phase 39 (storage only). Phase 41 adds external window verification. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-39-01 | T-39-01 | Local WebSocket, single user, no external network exposure | GSD security audit | 2026-04-11 |
| AR-39-02 | T-39-02 | Idempotent Tauri IPC, no resource exhaustion possible | GSD security audit | 2026-04-11 |
| AR-39-03 | T-39-03 | Storage only in Phase 39; Zod schema validates type. Action validation deferred to Phase 40+ | GSD security audit | 2026-04-11 |
| AR-39-04 | T-39-04 | HWND integer has no sensitivity in same-process context | GSD security audit | 2026-04-11 |
| AR-39-05 | T-39-05 | MCP callers are local trusted processes; HWND verification planned for Phase 41 | GSD security audit | 2026-04-11 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-11 | 5 | 5 | 0 | GSD orchestrator |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-11
