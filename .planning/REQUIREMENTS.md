# Requirements: Chat Overlay Widget

**Defined:** 2026-04-10
**Core Value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart

## v1.9 Requirements

Requirements for Guided Desktop Walkthrough milestone. Each maps to roadmap phases.

### Overlay Lifecycle

- [ ] **OVRL-01**: Overlay auto-shows when a walkthrough starts (no manual toggle needed)
- [ ] **OVRL-02**: Overlay auto-hides when walkthrough completes or is cancelled
- [ ] **OVRL-03**: Walkthrough can be bound to a target window (hwnd) at start time

### Focus Awareness

- [ ] **FOCUS-01**: Overlay hides when user switches to an app other than the walkthrough target
- [ ] **FOCUS-02**: Overlay re-appears when user switches back to the target app
- [ ] **FOCUS-03**: Focus tracking is event-driven (SetWinEventHook) or polling-based with <500ms latency

### External Window Verification

- [ ] **VRFY-01**: Pixel-sample verification can target an external window by hwnd (not just self-capture)
- [ ] **VRFY-02**: Pixel-sample coordinates are DPI-aware (logical coordinates scaled to physical at use)
- [ ] **VRFY-03**: Screenshot-diff endpoint is functional with baseline capture and runtime comparison
- [ ] **VRFY-04**: Visual change polling runs automatically with exponential backoff (500ms to 2s) for walkthrough auto-advance

### UI Automation State

- [ ] **UIA-01**: User can query element state (IsEnabled, IsOffscreen) on external app elements
- [ ] **UIA-02**: User can read TogglePattern state (On/Off/Indeterminate) for checkboxes
- [ ] **UIA-03**: User can read ValuePattern state (current value, IsReadOnly) for text fields
- [ ] **UIA-04**: User can read SelectionItemPattern state (IsSelected) for list items
- [ ] **UIA-05**: User can poll for element state change with configurable timeout and interval

### Safety

- [ ] **SAFE-01**: Walkthrough verification has a maxWaitMs timeout to prevent indefinite hangs

## Future Requirements

### Automation Execution

- **AUTO-01**: LLM can move mouse to screen coordinates and click
- **AUTO-02**: LLM can type text at current cursor position
- **AUTO-03**: Computer Use API bridge for autonomous see-think-act loop

### Advanced Overlay

- **ADV-01**: Annotations reposition when target window moves or resizes
- **ADV-02**: Multi-monitor awareness for annotation coordinate mapping
- **ADV-03**: ExpandCollapsePattern and RangeValuePattern support in UI Automation

## Out of Scope

| Feature | Reason |
|---------|--------|
| Click-coordinate tracking for step advancement | Unreliable — ghost mode blocks mouse events; clicks don't confirm action success |
| DLL injection into target apps (Steam/Discord pattern) | Security risk, admin privileges, antivirus interference |
| Desktop Duplication API for change detection | Overkill for single-window monitoring; requires DirectX 11 |
| Real-time video stream of external windows | High bandwidth, DWM compositor constraint in WebView2 |
| Annotation rendering inside external app processes | Impossible without DLL injection; OS-level transparent overlay is the correct pattern |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OVRL-01 | — | Pending |
| OVRL-02 | — | Pending |
| OVRL-03 | — | Pending |
| FOCUS-01 | — | Pending |
| FOCUS-02 | — | Pending |
| FOCUS-03 | — | Pending |
| VRFY-01 | — | Pending |
| VRFY-02 | — | Pending |
| VRFY-03 | — | Pending |
| VRFY-04 | — | Pending |
| UIA-01 | — | Pending |
| UIA-02 | — | Pending |
| UIA-03 | — | Pending |
| UIA-04 | — | Pending |
| UIA-05 | — | Pending |
| SAFE-01 | — | Pending |

**Coverage:**
- v1.9 requirements: 16 total
- Mapped to phases: 0
- Unmapped: 16

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 after initial definition*
