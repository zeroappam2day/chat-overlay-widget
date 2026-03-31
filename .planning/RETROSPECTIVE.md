# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

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

### Top Lessons (Verified Across Milestones)

1. Protocol/contract-first development prevents integration surprises (v1.3 Phase 16, v1.2 Phase 11)
2. PowerShell inline C# via template literals works reliably for Windows system calls — no .ps1 file management needed (v1.2, v1.3)
3. Export script-building functions for testability — test the PS script content without spawning PowerShell (v1.2 Phase 13, v1.3 Phase 17/18)
