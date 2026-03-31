# Requirements: Chat Overlay Widget

**Defined:** 2026-03-31
**Core Value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart

## v1.4 Requirements

Requirements for stable window targeting. Each maps to roadmap phases.

### Protocol Extension

- [x] **PROT-01**: Enumeration stores HWND (via ToInt64()) for each window in WindowInfo and WindowThumbnail
- [x] **PROT-02**: Enumeration stores process ID (PID) for each window
- [x] **PROT-03**: Root-window assertion filters to GetParent==IntPtr.Zero only (no child render handles)
- [ ] **PROT-04**: WebSocket protocol includes hwnd and pid fields in capture-window-with-metadata message
- [ ] **PROT-05**: Title-only capture (overlay-capture CLI, HTTP API) continues working without HWND

### HWND Capture

- [ ] **HWND-01**: Capture uses HWND directly via PrintWindow instead of title substring re-enumeration
- [ ] **HWND-02**: Stale HWND validated via GetWindowThreadProcessId + PID cross-check before capture
- [ ] **HWND-03**: Blank-bitmap detection identifies black/empty captures from elevated windows with warning
- [ ] **HWND-04**: When HWND is stale, falls back to title+processName match with warning message

## Future Requirements

### Enhanced Window Targeting

- **ETGT-01**: UWP/Store app detection and tagging during enumeration
- **ETGT-02**: Multi-monitor window grouping in picker
- **ETGT-03**: Auto-refresh thumbnails on window title change

## Out of Scope

| Feature | Reason |
|---------|--------|
| Click-to-capture with cursor overlay | Overlay steals focus (documented in PROJECT.md) |
| Hover-to-highlight window selection | Same focus-stealing constraint |
| DWM live thumbnails | WebView2 compositor constraint (documented) |
| Windows.Graphics.Capture API | Requires user consent dialog per session, overkill for screenshot tool |
| HWND as hex string | Decimal is simpler, fits JS number, matches ToInt64() output |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROT-01 | Phase 21 | Complete |
| PROT-02 | Phase 21 | Complete |
| PROT-03 | Phase 21 | Complete |
| PROT-04 | Phase 21 | Pending |
| PROT-05 | Phase 21 | Pending |
| HWND-01 | Phase 22 | Pending |
| HWND-02 | Phase 22 | Pending |
| HWND-03 | Phase 22 | Pending |
| HWND-04 | Phase 22 | Pending |

**Coverage:**
- v1.4 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after initial definition*
