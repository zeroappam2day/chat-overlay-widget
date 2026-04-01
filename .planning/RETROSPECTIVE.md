# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.5 — Self-Observation & Agent Visibility

**Shipped:** 2026-04-01
**Phases:** 3 | **Plans:** 7 | **Commits:** 14

### What Was Built
- 64KB rolling ring buffer with ANSI/OSC stripping wired into PTYSession
- Cursor-paginated HTTP APIs: GET /terminal-state and GET /session-history
- Best-effort secret scrubber with 18 regex patterns and provider trust tiers
- Self-screenshot capture via PrintWindow with secret-region blurring (sharp SVG compositing)
- GET /screenshot route with ?blur param, error mapping, X-Blur-Warning header

### What Worked
- Layered approach (buffer → scrubber → screenshot) meant each phase built cleanly on the previous
- Caller-delegated trust tiers (?scrub/?blur params) kept server logic simple — no caller identity management
- Phase 24 stress testing (5 adversarial reviews) correctly identified that Phases 26-29 should be a separate milestone
- 140 sidecar tests total — high confidence in correctness without manual testing overhead

### What Was Inefficient
- Phase 25 code was never committed (remained as untracked files) — sidecar dist/ also stale from Phase 21
- Milestone audit scored 7/15 because it included v1.6 requirements that were rescoped out — audit should be re-run after scope changes
- Phase 25 SUMMARY files lacked one_liner frontmatter, breaking automated accomplishment extraction

### Patterns Established
- `?param=true|false` with safe defaults for all HTTP routes (scrub=true, blur=true)
- `X-Warning` response headers for best-effort operations (X-Scrub-Warning, X-Blur-Warning)
- `detectSecrets()` returns line numbers for both text redaction and pixel-row blurring — shared detection, different rendering
- sharp SVG compositing for pixel-level image manipulation (blur/blackout)

### Key Lessons
1. Commit code as soon as tests pass — leaving Phase 25 uncommitted created confusion during milestone audit
2. Re-run milestone audit after scope changes — stale audits produce misleading scores
3. SUMMARY one_liner frontmatter should be mandatory — automated extraction depends on it
4. Stress testing before planning (5 adversarial reviews) is high-value — correctly split v1.5/v1.6 scope

### Cost Observations
- Model mix: primarily opus for planning/execution, sonnet for verification
- Sessions: ~4 sessions across 2 days
- Notable: 3 phases completed in 1 day — fastest per-phase rate yet, benefiting from established HTTP route patterns

---

## Milestone: v1.3 — Window Picker & LLM-Actionable Capture

**Shipped:** 2026-03-31
**Phases:** 5 | **Plans:** 7 | **Commits:** 31

### What Was Built
- Shared WebSocket protocol types for batch thumbnails and enriched capture
- Batch thumbnail engine — single async PS spawn for all windows, 240x180 base64 PNGs with 5s cache
- Enriched capture with pixel-accurate bounds, DPI scale, and capture dimensions
- Window Picker UI — thumbnail grid popover with keyboard navigation, search filter, manual refresh
- Metadata injection pipeline — computer_use coordinate format injected into ChatInputBar

### What Worked
- Protocol-first approach (Phase 16 before implementation) prevented type mismatches between sidecar and frontend
- TDD pattern (buildBatchThumbnailScript, captureWindowWithMetadata, formatCaptureBlock exported for testability) caught issues before manual testing
- Single async PS spawn pattern for batch thumbnails — efficient, no per-window overhead
- Reusing established patterns (PrintWindow PW_RENDERFULLCONTENT, spawnSync with args array, pickerOpenRef) reduced ramp-up time

### What Was Inefficient
- jsdom v27 incompatibility with Node 20.17.0 required downgrade to v24 — discovered during test execution, not during planning
- Phase 19 SUMMARY extraction was noisy (bug reports mixed with accomplishments) — SUMMARY one-liners should focus on deliverables not issues

### Patterns Established
- `buildXxxScript()` export pattern for PowerShell script testability (started Phase 13, extended to Phase 17/18)
- `xxxRef` pattern for keyboard gating in multi-pane context (isActiveRef, pickerOpenRef)
- `@vitest-environment jsdom` docblock per test file to avoid global environment pollution
- `# comment` metadata format for LLM-readable coordinate blocks (no JSON parsing needed)
- Pipe-delimited PS output for multi-field structured data (captureWindowWithMetadata)

### Key Lessons
1. Pin jsdom version to match Node.js runtime in CI/dev — ESM/CJS boundaries break silently on version mismatches
2. Protocol types landing first (Phase 16) is worth the overhead — every subsequent phase imported types without friction
3. computer_use coordinate format is a good bet for forward-compatibility with Claude automation features

### Cost Observations
- Model mix: primarily opus for planning/execution, sonnet for verification
- Sessions: ~6 sessions across 2 days
- Notable: 5 phases in 2 days — fastest milestone yet, benefiting from established capture patterns in v1.2

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Timeline | Key Change |
|-----------|--------|-------|----------|------------|
| v1.0 | 5 | 11 | ~1 day | Initial scaffolding, everything new |
| v1.1 | 4 (1 active + 3 superseded) | 2 | ~1 day | HTTP API approach abandoned mid-milestone |
| v1.2 | 6 | 9 | ~1 day | Capture infrastructure + Claude skill established |
| v1.3 | 5 | 7 | 2 days | Protocol-first, TDD patterns mature |
| v1.4 | 2 | 4 | 1 day | HWND stability, stale detection |
| v1.5 | 3 | 7 | 1 day | HTTP API layering, secret scrubbing, stress-test-driven scope |

### Top Lessons (Verified Across Milestones)

1. Protocol/contract-first development prevents integration surprises (v1.3 Phase 16, v1.2 Phase 11)
2. PowerShell inline C# via template literals works reliably for Windows system calls — no .ps1 file management needed (v1.2, v1.3)
3. Export script-building functions for testability — test the PS script content without spawning PowerShell (v1.2 Phase 13, v1.3 Phase 17/18)
4. Safe defaults with explicit opt-out (?scrub=true, ?blur=true) prevent accidental data exposure (v1.5)
5. Stress testing before planning prevents scope creep — adversarial reviews correctly identified milestone boundaries (v1.5)
