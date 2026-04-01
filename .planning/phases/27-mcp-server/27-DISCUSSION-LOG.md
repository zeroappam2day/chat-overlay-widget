# Phase 27: MCP Server - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-01
**Phase:** 27-mcp-server
**Mode:** adversarial stress test (user-requested multi-view analysis)
**Areas analyzed:** Process Model, SDK Choice, Tool Scope, Trust Tier

---

## Pre-Discussion: Phase 26 Reconciliation

ROADMAP marked Phase 26 complete but STATE.md showed "Checkpoint: Task 3 E2E validation awaiting user approval (26-02)". Live E2E testing confirmed all 3 success criteria pass:
- POST /hook-event: 200 in 1.8ms (< 500ms requirement)
- 401 on bad token: correct
- 400 on missing type: correct
Phase 26 is complete. STATE.md was stale.

## Pre-Discussion: A2 Assumption Spike

STATE.md flagged assumption A2: "MCP stdio server launched by Claude Code can connect back to sidecar HTTP API." Validated in 4 steps:
1. Discovery file readable from external process: YES
2. /health: 200 in 1.3ms
3. /terminal-state: 200, returns live buffer with scrub warning
4. /session-history: 200, returns historical data
**A2 confirmed safe.** No circular dependency. Discovery file pattern works.

---

## Stress Test Round 1: Is Phase 27 the Right Next Step?

7 adversarial views examined before any gray area discussion:

| View | Challenge | Verdict |
|------|-----------|---------|
| Sequencing Skeptic | Phase 26 not done | Resolved: live E2E confirmed |
| Assumption Assassin | A2 not proven by hooks | Resolved: spike validated |
| Milestone Strategist | Do 27+28 in parallel | Valid insight but serial discuss is required. No constraints created. |
| Minimalist | HTTP APIs sufficient without MCP | Rejected: LLM-01 requires MCP. Discovery + multi-tool support justify it. |
| Security Auditor | MCP as privilege escalation | Low risk: single-user local tool. Same-user processes already have access. |
| Build Engineer | Caxa bundling concerns | Identified as #1 architectural decision — drove research agenda. |
| User Advocate | No visible value until Phase 29 | Correct: Phase 27 is infrastructure. Acknowledged. |

**Outcome:** Proceed with Phase 27. Spike A2 first. Two genuine gray areas identified for research.

## Stress Test Round 2: Should We Discuss Gray Areas Now?

7 more adversarial views on the meta-question:

| View | Challenge | Verdict |
|------|-----------|---------|
| Context Economist | Already know most answers | 2 of 4 gray areas pre-answered (tool scope, trust tier) |
| Workflow Purist | No artifacts written yet | Valid: insights must be persisted to CONTEXT.md |
| Researcher | Need facts before decisions | Strong: SDK compat and caxa extraction need research, not discussion |
| Pragmatist | MCP server doesn't need caxa at all | Reframed process model — single-user local tool could use unbundled .js |
| Completionist | Screenshot tool has format complexity | Tilts toward SDK for image content type handling |
| Security Minimalist | Trust tier is a non-decision | Confirmed: always scrub, non-negotiable |
| Parallel Thinker | Research + discuss simultaneously | Best approach: research then present informed 1-2 decisions |

**Outcome:** Research first, then lock decisions.

---

## Research Phase

4 parallel research agents launched:

| Agent | Status | Key Findings |
|-------|--------|-------------|
| SDK Compatibility | API overload (529) | Covered manually via npm view: 17 deps, no native, CJS works, 677 files |
| Caxa Extraction | **SUCCESS** | Read actual stub.go + index.mts source. Stable paths, CLI passthrough, auto-bundling confirmed. |
| Brownfield Examples | API overload (529) | N/A |
| Process Model Patterns | API overload (529) | N/A |

### Direct research (supplementing failed agents)

**SDK empirical testing:**
- Installed to /tmp/mcp-test, tested CJS require paths
- `McpServer` + `StdioServerTransport` + `z` (zod) import: 129ms
- Tool registration with zod schema: works
- Image content response: works (`{ type: 'image', data, mimeType }`)
- Runtime deps: only SDK + zod loaded (express/hono/cors not imported in stdio path)
- Disk: SDK 5.6MB + zod 5.7MB = ~11MB

**Caxa findings (from successful agent reading stub.go source):**
- Extraction: `%TEMP%/caxa/apps/<identifier>/<attempt>/` — stable across runs
- `{{caxa}}` replaced at runtime by Go stub (regex) — NOT available as env var
- CLI args pass through: `os.Args[1:]` appended to command
- All `dist/*.js` files auto-bundled by glob
- Cached after first extraction — instant on subsequent runs
- Extracted node.exe at: `<extraction_dir>/node_modules/.bin/node.exe`

---

## Process Model

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| A: Single .exe, subcommand | Zero extra size, self-extracting, no runtime deps | Two modes in one binary (mitigated by early exit) | **YES** |
| B: Second caxa binary | Clean separation | +73MB, two build pipelines | |
| C: Unbundled .js file | Simplest code | Requires Node.js on PATH, breaks portability | |
| D: Thin .js inside caxa | No extra size | Fails if sidecar hasn't run yet (no extraction) | |

**User's choice:** Auto-derived from evidence — Option A wins on all criteria.
**Notes:** 5 adversarial iterations confirmed. Early exit pattern prevents port conflict. Caxa CLI passthrough validated from source code.

## SDK Choice

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Official SDK | Protocol compliance, image support, future-proof, 30 lines of code | 11MB disk, 17 listed deps (2 loaded) | **YES** |
| Hand-roll | 0 deps, ~205 lines, full control | Protocol compliance risk, image encoding risk, maintenance burden | |
| FastMCP | Higher-level API | Wraps SDK + adds 14 more deps. Heavier, not lighter. | |

**User's choice:** Auto-derived from evidence — SDK wins on reliability/maintenance.
**Notes:** 6 adversarial iterations. Key insight: express/hono/cors don't load in stdio mode.

## Tool Scope

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| 3 tools (SC1-SC3) | Matches requirements exactly, tight scope | No agent events access | **YES** |
| 3 + agent_events | Future-proofs Phase 28 | Scope creep, Phase 28 owns event delivery | |
| 3 + list_sessions | Convenience | Not in LLM-01, can add later | |

**User's choice:** Locked by requirements — 3 tools.
**Notes:** Extensible via `server.tool()` in future phases.

## Trust Tier

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Always scrub/blur | Safe default, matches cloud LLM data flow | No raw access via MCP | **YES** |
| Trust tier parameter | Flexibility for local LLMs | Security risk (claims unverifiable), complexity | |
| Per-tool override | Granular control | Unnecessary — HTTP API available for raw access | |

**User's choice:** Auto-derived from data flow analysis — always scrub.
**Notes:** 5 adversarial iterations. Raw access via HTTP for advanced users.

## Claude's Discretion

- Tool description wording
- Connection retry vs fail-fast
- zod schema constraints
- list_sessions parameter mode inside query_session_history

## Deferred Ideas

- Agent events MCP tool — Phase 28
- list_sessions tool — backlog
- SSE transport — SSE-01 requirement
- Trust tier parameter — revisit if local LLM MCP clients emerge
- Connection pooling — evaluate if latency becomes an issue

---

_Discussion log: 2026-04-01_
_Mode: adversarial stress test with parallel research_
