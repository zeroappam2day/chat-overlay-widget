# Phase 35: PM Chat Settings UI - Research

**Researched:** 2026-04-09
**Domain:** React/Zustand frontend — localStorage persistence, Ollama /api/tags, settings panel UI inside AgentSidebar
**Confidence:** HIGH (all claims verified against live codebase)

## Summary

Phase 35 must add a settings panel to the PM Chat tab that persists four values: model selection (from Ollama /api/tags), system prompt (textarea), temperature (slider, 0.0–1.0), and custom endpoint URL. All four values must survive app restarts via localStorage. The settings must be consumed by PMChatTab.tsx's `handleSend` when sending a message, replacing the three hardcoded literals currently in that function.

The sidecar backend (`pmChat.ts`) already accepts `endpoint?` in `streamOllamaChat` options, but the protocol type definition and the server.ts handler do not yet forward it. Minimal sidecar changes are required.

Phase 36 (conversational context) will consume `model`, `temperature`, `systemPrompt`, and `endpoint` from the same settings store, so the store shape established here is downstream-load-bearing.

**Primary recommendation:** Create `pmChatSettingsStore.ts` (Zustand + localStorage, pattern from themeStore/bookmarkStore) and a `PMChatSettings` component rendered as a collapsible panel inside PMChatTab's header row, toggled by a gear icon.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SET-01 | User can select from available Ollama models via dropdown populated from /api/tags | Ollama /api/tags verified live: `models[].name` array; fetch direct from webview (no sidecar proxy needed) |
| SET-02 | User can edit the PM system prompt in a textarea, persisted to localStorage | localStorage pattern verified in featureFlagStore/themeStore/bookmarkStore |
| SET-03 | User can adjust LLM temperature via slider (default 0.0), persisted to localStorage | Same persistence pattern; PMChatTab currently hardcodes `temperature: 0.0` |
| SET-04 | User can configure custom Ollama endpoint URL, persisted to localStorage | pmChat.ts already accepts `endpoint?`; protocol.ts and server.ts need the field added |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- GSD workflow required before any file edits (use `/gsd:execute-phase` for this phase work)
- Tauri v1.8 / React 18 / Vite 5 / TypeScript — no Tauri v2 APIs
- Zustand (not Context, not Redux) for all stores
- Tailwind CSS with existing dark palette (`#0d1117`, `#21262d`, `#30363d`, `#e6edf3`, `#58a6ff`)
- Test every new store and component with Vitest + Testing Library (vitest.config.ts covers `src/**/*.test.tsx`)
- No half-wired modules — everything must be wired end-to-end or removed

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| zustand | installed | Settings store + localStorage persistence | Already used — pattern established |
| React 18 | installed | Settings panel component | Already used |
| Tailwind CSS | installed | Styling — dark glass palette | Already used |

No new packages required. [VERIFIED: live codebase inspection]

## Architecture Patterns

### Persistence Pattern (from themeStore and bookmarkStore)

The project uses a consistent 3-part Zustand localStorage pattern: [VERIFIED: src/store/themeStore.ts, src/store/bookmarkStore.ts, src/store/featureFlagStore.ts]

```typescript
// 1. STORAGE_KEY constant
const STORAGE_KEY = 'chat-overlay-pm-chat-settings';

// 2. Loader function called at store creation
function loadSettings(): Partial<PMChatSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// 3. Store: spread defaults + spread loaded values at init; write on every mutation
export const usePmChatSettingsStore = create<PMChatSettingsStore>((set) => ({
  ...defaults,
  ...loadSettings(),
  setSetting: (key, value) => set((s) => {
    const next = { ...s, [key]: value };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      model: next.model,
      systemPrompt: next.systemPrompt,
      temperature: next.temperature,
      endpoint: next.endpoint,
    }));
    return { [key]: value };
  }),
}));
```

### Settings Store Shape

```typescript
interface PMChatSettingsState {
  model: string;            // SET-01 — default: 'qwen3:0.6b' (current hardcoded value)
  systemPrompt: string;     // SET-02
  temperature: number;      // SET-03 — default: 0.0
  endpoint: string;         // SET-04 — default: 'http://127.0.0.1:11434'
}

interface PMChatSettingsStore extends PMChatSettingsState {
  setSetting: <K extends keyof PMChatSettingsState>(key: K, value: PMChatSettingsState[K]) => void;
  resetSettings: () => void;
}
```

### Model Dropdown Pattern (SET-01)

Ollama /api/tags returns: [VERIFIED: live curl http://127.0.0.1:11434/api/tags]

```json
{
  "models": [
    { "name": "qwen3:8b", "model": "qwen3:8b", "details": { "parameter_size": "8.2B" } },
    { "name": "nomic-embed-text:latest", ... }
  ]
}
```

Fetch strategy: direct from webview via `fetch('http://127.0.0.1:11434/api/tags')` — no sidecar proxy needed since Ollama already accepts cross-origin requests on localhost. [VERIFIED: Ollama running locally; no CORS issues for localhost]

```typescript
// In PMChatSettings component — fetch on mount, cache in component state
const [models, setModels] = useState<string[]>([]);
const [modelsLoading, setModelsLoading] = useState(false);

useEffect(() => {
  setModelsLoading(true);
  fetch(`${endpoint}/api/tags`)
    .then(r => r.json())
    .then(d => setModels((d.models ?? []).map((m: { name: string }) => m.name)))
    .catch(() => setModels([]))
    .finally(() => setModelsLoading(false));
}, [endpoint]);  // re-fetch when endpoint changes
```

### Temperature Slider Pattern (SET-03)

```typescript
<input
  type="range"
  min="0"
  max="1"
  step="0.05"
  value={temperature}
  onChange={(e) => setSetting('temperature', parseFloat(e.target.value))}
  className="w-full accent-[#58a6ff]"
/>
<span className="text-[10px] text-[#8b949e] tabular-nums">{temperature.toFixed(2)}</span>
```

### UI Placement: Gear Icon in PMChatTab Header

The AgentSidebar renders PMChatTab inside its content area (no header controls of its own for PM Chat). The correct placement is a collapsible inline settings panel toggled by a gear icon in a header row above the message list — not a portal overlay (that pattern is used by FeatureFlagPanel which is a global settings panel, not a tab-local one).

```
┌─ PM Chat header row ──────────────────────────────[⚙]─┐
│  ┌─ settings panel (collapses) ────────────────────────┐ │
│  │  Model: [dropdown]                                   │ │
│  │  Endpoint: [text input]                              │ │
│  │  Temp: [slider] 0.00                                 │ │
│  │  System prompt: [textarea]                           │ │
│  └──────────────────────────────────────────────────────┘ │
│  [message list]                                          │
│  [input bar]                                             │
└──────────────────────────────────────────────────────────┘
```

### Wiring: PMChatTab handleSend

Current hardcoded values that become store reads:

```typescript
// BEFORE (current PMChatTab.tsx line 32-39):
wsSend({
  type: 'pm-chat',
  requestId,
  message: input.trim(),
  model: 'qwen3:0.6b',           // hardcoded
  temperature: 0.0,               // hardcoded
  systemPrompt: 'You are a...',   // hardcoded
});

// AFTER:
const { model, temperature, systemPrompt, endpoint } = usePmChatSettingsStore.getState();
wsSend({
  type: 'pm-chat',
  requestId,
  message: input.trim(),
  model,
  temperature,
  systemPrompt,
  endpoint,   // new field — requires protocol + server changes
});
```

### Protocol + Server Changes Required (SET-04)

Three files need updating for endpoint pass-through:

**1. `src/protocol.ts` — add `endpoint?` to pm-chat ClientMessage:**
```typescript
| { type: 'pm-chat'; requestId: string; message: string; model: string; temperature: number; systemPrompt: string; endpoint?: string }
```

**2. `sidecar/src/protocol.ts` — same change:**
```typescript
| { type: 'pm-chat'; requestId: string; message: string; model: string; temperature: number; systemPrompt: string; endpoint?: string }
```

**3. `sidecar/src/server.ts` — forward endpoint in streamOllamaChat call:**
```typescript
case 'pm-chat': {
  const pmMsg = msg as { type: 'pm-chat'; ...; endpoint?: string };
  streamOllamaChat(pmMsg.requestId, {
    message: pmMsg.message,
    model: pmMsg.model,
    temperature: pmMsg.temperature,
    systemPrompt: pmMsg.systemPrompt,
    endpoint: pmMsg.endpoint,   // was missing — pmChat.ts already accepts this
  }, { ... });
}
```

`pmChat.ts` already has `endpoint?` in its opts and uses it correctly — no changes needed there. [VERIFIED: sidecar/src/pmChat.ts line 15-21]

### Recommended Project Structure

New files:
```
src/store/pmChatSettingsStore.ts        # Settings store (SET-01–04)
src/components/PMChatSettings.tsx       # Settings panel component
src/components/__tests__/PMChatSettings.test.tsx  # Vitest tests
```

Modified files:
```
src/components/PMChatTab.tsx            # Add gear icon, render <PMChatSettings />, use store
src/protocol.ts                         # Add endpoint? to pm-chat type
sidecar/src/protocol.ts                 # Same change
sidecar/src/server.ts                   # Forward endpoint in pm-chat handler
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Custom state management | Custom React context for settings | Zustand (established project pattern) |
| Custom persistence | Custom localStorage wrapper | Inline localStorage in store setter (themeStore/bookmarkStore pattern) |
| Custom dropdown | Styled custom dropdown from scratch | Native `<select>` with Tailwind — consistent with project's minimal approach |
| Sidecar proxy for model list | New WS message type for tags | Direct fetch from webview — Ollama is local, no auth needed |

**Key insight:** The project avoids over-engineering. Native HTML elements (`<input type="range">`, `<textarea>`, `<select>`) styled with Tailwind are the right choice here — no headless UI library.

## Common Pitfalls

### Pitfall 1: Endpoint URL used for /api/tags but not for /api/chat
**What goes wrong:** User changes endpoint, model list updates but messages still go to default endpoint because `handleSend` reads hardcoded default.
**Why it happens:** Two separate code paths that both need the endpoint value.
**How to avoid:** Read `endpoint` from store in `handleSend`; include it in the WS message; server forwards it to `streamOllamaChat`.

### Pitfall 2: Model list fetch uses wrong endpoint on first render
**What goes wrong:** Settings panel mounts with the stored endpoint, but `useEffect` dep array doesn't include `endpoint`, so changing endpoint doesn't re-fetch.
**How to avoid:** Include `endpoint` in the `useEffect` dependency array for the /api/tags fetch.

### Pitfall 3: Temperature stored as string from input event
**What goes wrong:** `e.target.value` is always a string; if `parseFloat` is omitted, the stored value is `"0.5"` (string) and comparisons break.
**How to avoid:** Always `parseFloat(e.target.value)` when reading range input.

### Pitfall 4: pmChatSettingsStore not initialized before PMChatTab mounts
**What goes wrong:** PMChatTab reads from store before defaults+localStorage are merged.
**How to avoid:** Follow the existing pattern — load from localStorage at store creation time (in `create()` call), not in a `useEffect`.

### Pitfall 5: Protocol type mismatch — endpoint sent but type doesn't include it
**What goes wrong:** TypeScript accepts the message in PMChatTab but server.ts casts to the old type and silently ignores `endpoint`.
**How to avoid:** Update both `src/protocol.ts` AND `sidecar/src/protocol.ts` (they are separate files — [VERIFIED: both exist]).

### Pitfall 6: Settings panel occupies too much height in the 300px sidebar
**What goes wrong:** System prompt textarea + model dropdown + slider + endpoint input stacks to more than the available sidebar height.
**How to avoid:** Make the settings panel collapsible (toggle via gear icon); default collapsed. Textarea: 3–4 rows max, `resize-none`.

## Code Examples

### Verified: Zustand store with localStorage persistence

Source: `src/store/themeStore.ts` (simplest pattern) and `src/store/featureFlagStore.ts` (most complete pattern):

```typescript
// themeStore.ts — minimal pattern
const STORAGE_KEY = 'chat-overlay-theme';
function loadTheme(): ThemeId { ... }
export const useThemeStore = create<ThemeStore>((set) => ({
  activeTheme: loadTheme(),    // load at create time
  setTheme: (id) => {
    localStorage.setItem(STORAGE_KEY, id);  // write synchronously on mutation
    set({ activeTheme: id });
  },
}));
```

### Verified: Existing WS send pattern from PMChatTab

Source: `src/components/PMChatTab.tsx` line 32–39:

```typescript
wsSend({
  type: 'pm-chat',
  requestId,
  message: input.trim(),
  model: 'qwen3:0.6b',       // → replace with store read
  temperature: 0.0,           // → replace with store read
  systemPrompt: '...',        // → replace with store read
                              // + add endpoint from store
});
```

### Verified: Ollama /api/tags response shape

Source: live curl to running local Ollama instance:

```json
{
  "models": [
    { "name": "qwen3:8b", "model": "qwen3:8b", "details": { "parameter_size": "8.2B" } },
    { "name": "nomic-embed-text:latest", "model": "nomic-embed-text:latest" },
    { "name": "qwen3.5:0.8b", ... }
  ]
}
```

Extract: `data.models.map(m => m.name)` gives `["qwen3:8b", "nomic-embed-text:latest", "qwen3.5:0.8b"]`.

### Verified: How Phase 36 (CHAT-02/CHAT-03) will consume settings

Source: ROADMAP.md Phase 36 success criteria: "each outgoing message... includes the last N lines of terminal output injected automatically." Phase 36 reads model/temperature/systemPrompt/endpoint from the same settings store and adds a `messages` history array to the pm-chat WS payload. The settings store shape created in Phase 35 must not change field names between phases.

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| v1.7 Phase 30 (LLM Settings Store, abandoned) | v1.8 Phase 35 (combined settings UI + store) | v1.7 split into two phases; v1.8 combines store + UI in one phase since the store has no value without the UI |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Direct webview fetch to Ollama /api/tags works without CORS error inside Tauri WebView2 | Architecture Patterns (SET-01) | If WebView2 blocks cross-origin localhost fetch, need a WS message type to proxy the request through sidecar |
| A2 | Default model should be 'qwen3:0.6b' (current hardcoded value) | Settings Store Shape | User may not have this model; dropdown should show actual installed models and default to first in list if stored value not found |

**A1 note:** Ollama by default sets `Access-Control-Allow-Origin: *` on all responses. WebView2 localhost requests are also typically exempt from CORS restrictions. Risk is LOW.
**A2 note:** Planner should handle the case where stored model is not in the /api/tags list — either show warning or auto-select first available.

## Open Questions

1. **Should the settings panel be open by default or closed?**
   - What we know: FeatureFlagPanel defaults closed; sidebar space is limited (300px width)
   - What's unclear: User expectation — first-time users won't know settings exist if closed
   - Recommendation: Default closed with gear icon tooltip "PM Chat Settings"; the health-ok empty state message can hint at it

2. **Should fetch errors on /api/tags show a fallback or block settings?**
   - What we know: Ollama may not be running when settings panel opens
   - What's unclear: Health check fires on tab open but settings could be opened before health is resolved
   - Recommendation: Show empty dropdown with "No models found" placeholder; endpoint field remains editable

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Ollama | SET-01 /api/tags fetch | Yes (verified) | Running locally | Empty model list with placeholder |
| Node.js / sidecar | SET-04 endpoint forwarding | Yes | Always running when app is open | N/A |
| localStorage | SET-02/03/04 persistence | Yes (WebView2) | Always | N/A |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + @testing-library/react 16 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/store/pmChatSettingsStore.test.ts src/components/__tests__/PMChatSettings.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SET-01 | Model dropdown renders options from /api/tags | unit (mock fetch) | `npx vitest run src/components/__tests__/PMChatSettings.test.tsx` | No — Wave 0 |
| SET-02 | System prompt textarea value persists in localStorage | unit | `npx vitest run src/store/pmChatSettingsStore.test.ts` | No — Wave 0 |
| SET-03 | Temperature slider persists value in localStorage | unit | `npx vitest run src/store/pmChatSettingsStore.test.ts` | No — Wave 0 |
| SET-04 | Endpoint URL persists in localStorage; forwarded in pm-chat WS message | unit | `npx vitest run src/store/pmChatSettingsStore.test.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/store/pmChatSettingsStore.test.ts src/components/__tests__/PMChatSettings.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/store/pmChatSettingsStore.test.ts` — covers SET-02/03/04 store persistence
- [ ] `src/components/__tests__/PMChatSettings.test.tsx` — covers SET-01 dropdown render, SET-02/03/04 controls

## Security Domain

This phase has no security-sensitive operations (no auth, no secrets, no external network access beyond localhost Ollama, no user data leaving the machine). localStorage values are user-controlled settings only.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Minimal | temperature clamped to [0.0, 1.0] via slider; endpoint URL validated as URL before use |
| V2 Authentication | No | Local only |
| V6 Cryptography | No | No secrets stored |

## Sources

### Primary (HIGH confidence)
- Live codebase: `src/store/pmChatStore.ts` — current store, no persistence
- Live codebase: `src/store/featureFlagStore.ts` — localStorage persistence pattern
- Live codebase: `src/store/themeStore.ts` — minimal localStorage pattern
- Live codebase: `src/store/bookmarkStore.ts` — localStorage with array serialization
- Live codebase: `src/components/PMChatTab.tsx` — hardcoded model/temp/systemPrompt (lines 36-39)
- Live codebase: `src/components/AgentSidebar.tsx` — tab layout, PMChatTab rendering
- Live codebase: `sidecar/src/pmChat.ts` — `endpoint?` already accepted in streamOllamaChat
- Live codebase: `sidecar/src/server.ts` — pm-chat handler missing endpoint pass-through
- Live codebase: `src/protocol.ts` + `sidecar/src/protocol.ts` — pm-chat type missing endpoint?
- Live Ollama: `curl http://127.0.0.1:11434/api/tags` — verified response shape
- Live codebase: `vitest.config.ts` — test runner config confirmed

### Secondary (MEDIUM confidence)
- ROADMAP.md Phase 36 — Phase 36 depends on settings store shape; store field names are locked by this phase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, patterns verified in codebase
- Architecture: HIGH — existing store/component patterns directly applicable
- Pitfalls: HIGH — verified by reading actual code paths and protocol types
- Ollama /api/tags shape: HIGH — verified against live running instance

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable stack, no fast-moving dependencies)
