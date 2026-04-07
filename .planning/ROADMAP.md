1	# Roadmap: Chat Overlay Widget
2	
3	## Milestones
4	
5	- ✅ **v1.0 Core Application** — Phases 1-5 (shipped 2026-03-28)
6	- ✅ **v1.1 Screenshot Automation & Input Polish** — Phases 6-9 (shipped 2026-03-30)
7	- ✅ **v1.2 Live App Awareness & Capture** — Phases 10-15 (shipped 2026-03-30)
8	- ✅ **v1.3 Window Picker & LLM-Actionable Capture** — Phases 16-20 (shipped 2026-03-31)
9	- ✅ **v1.4 Stable Window Targeting** — Phases 21-22 (shipped 2026-03-31)
10	- ✅ **v1.5 Self-Observation & Agent Visibility** — Phases 23-25 (shipped 2026-04-01)
11	- ✅ **v1.6 Agent Hooks & MCP Integration** — Phases 26-29 (shipped 2026-04-07)
12	- 🚧 **v1.7 PM Voice Chat** — Phases 30-33 (planned)
13	
14	## Phases
15	
16	<details>
17	<summary>✅ v1.0 Core Application (Phases 1-5) — SHIPPED 2026-03-28</summary>
18	
19	- [x] Phase 1: Scaffolding (2/2 plans) — completed 2026-03-28
20	- [x] Phase 2: PTY Bridge (2/2 plans) — completed 2026-03-28
21	- [x] Phase 3: Chat Overlay MVP (2/2 plans) — completed 2026-03-28
22	- [x] Phase 4: Differentiating Features (4/4 plans) — completed 2026-03-28
23	- [x] Phase 5: Production Hardening (1/1 plan) — completed 2026-03-28
24	
25	</details>
26	
27	<details>
28	<summary>✅ v1.1 Screenshot Automation & Input Polish (Phases 6-9) — SHIPPED 2026-03-30</summary>
29	
30	- [x] Phase 6: Shell Path Formatting & Input Bar (2/2 plans) — completed 2026-03-30
31	- [x] Phase 7: Capture HTTP Server — superseded by v1.2
32	- [x] Phase 8: Window Screenshot Capture — superseded by v1.2
33	- [x] Phase 9: Browser CDP Capture & CLI Wrapper — superseded by v1.2
34	
35	</details>
36	
37	<details>
38	<summary>✅ v1.2 Live App Awareness & Capture (Phases 10-15) — SHIPPED 2026-03-30</summary>
39	
40	- [x] Phase 10: Split Pane Preservation (2/2 plans) — completed 2026-03-30
41	- [x] Phase 11: Capture Infrastructure (2/2 plans) — completed 2026-03-30
42	- [x] Phase 12: Window Enumeration (1/1 plan) — completed 2026-03-30
43	- [x] Phase 13: Window Capture (2/2 plans) — completed 2026-03-30
44	- [x] Phase 14: CLI Wrapper (1/1 plan) — completed 2026-03-30
45	- [x] Phase 15: Claude Skill (1/1 plan) — completed 2026-03-30
46	
47	</details>
48	
49	<details>
50	<summary>✅ v1.3 Window Picker & LLM-Actionable Capture (Phases 16-20) — SHIPPED 2026-03-31</summary>
51	
52	- [x] Phase 16: Protocol Extension (1/1 plan) — completed 2026-03-30
53	- [x] Phase 17: Batch Thumbnail Backend (1/1 plan) — completed 2026-03-30
54	- [x] Phase 18: Enriched Capture Backend (1/1 plan) — completed 2026-03-30
55	- [x] Phase 19: Window Picker UI (2/2 plans) — completed 2026-03-31
56	- [x] Phase 20: Metadata Injection & Integration (2/2 plans) — completed 2026-03-31
57	
58	</details>
59	
60	<details>
61	<summary>✅ v1.4 Stable Window Targeting (Phases 21-22) — SHIPPED 2026-03-31</summary>
62	
63	- [x] Phase 21: Protocol Extension (2/2 plans) — completed 2026-03-31
64	- [x] Phase 22: HWND-Based Capture (2/2 plans) — completed 2026-03-31
65	
66	</details>
67	
68	<details>
69	<summary>✅ v1.5 Self-Observation & Agent Visibility (Phases 23-25) — SHIPPED 2026-04-01</summary>
70	
71	- [x] Phase 23: Terminal Buffer Layer (2/2 plans) — completed 2026-03-31
72	- [x] Phase 24: Secret Scrubber & Trust Tiers (3/3 plans) — completed 2026-03-31
73	- [x] Phase 25: Screenshot Self-Capture (2/2 plans) — completed 2026-03-31
74	
75	</details>
76	
77	<details>
78	<summary>✅ v1.6 Agent Hooks & MCP Integration (Phases 26-29) — SHIPPED 2026-04-07</summary>
79	
80	- [x] **Phase 26: Hook Receiver & Event Schema** - Hook endpoint, normalized AgentEvent schema (completed 2026-04-01)
81	- [x] **Phase 27: MCP Server** - stdio MCP server wrapping terminal, history, and screenshot tools (completed 2026-04-01)
82	- [x] **Phase 28: Adapter Layer & Sidebar** - Hook adapters for Claude Code/Windsurf/Cursor, sidebar event panel (completed 2026-04-01)
83	- [ ] **Phase 29: Auto-Configuration** - Zero-setup hook config and MCP registration injection on startup
84	
85	</details>
86	
87	### 🚧 v1.7 PM Voice Chat (Planned)
88	
89	**Milestone Goal:** A conversational PM assistant that reads terminal state, summarizes it via local Ollama LLM in non-technical CEO-friendly language, and speaks it via Windows SAPI5 — with persistent LLM settings and follow-up chat.
90	
91	- [ ] **Phase 30: LLM Settings Store** - Zustand store with localStorage persistence for model, system prompt, temperature, and endpoint
92	- [ ] **Phase 31: Ollama Chat Backend & Sidebar Tab** - Streaming /api/chat sidecar route, health check, PM Chat sidebar tab UI
93	- [ ] **Phase 32: Conversational Context** - Terminal context injection per message, 20-turn history cap, follow-up flow
94	- [ ] **Phase 33: TTS Voice Engine** - Persistent PowerShell SAPI5 process, stop control, voice/rate settings, auto-speak toggle
95	
96	## Phase Details
97	
98	> v1.0–v1.5 phase details archived to `.planning/milestones/`
99	
100	## v1.6 Phase Details
101	
102	### Phase 26: Hook Receiver & Event Schema
103	**Goal**: The sidecar can receive and normalize lifecycle events from any supported AI coding agent
104	**Depends on**: Phase 25
105	**Requirements**: AGNT-01, AGNT-02
106	**Success Criteria** (what must be TRUE):
107	  1. `POST /hook-event` on the sidecar accepts hook payloads (SubagentStart, SubagentStop, PreToolUse, PostToolUse) and responds within 500ms
108	  2. Every received hook payload is normalized to a shared `AgentEvent` object with consistent `tool`, `type`, `timestamp`, `sessionId`, and `payload` fields regardless of the originating tool
109	  3. Events from Claude Code hooks delivered via curl reach the sidecar and are logged with their normalized schema
110	**Plans:** 2/2 plans complete
111	Plans:
112	- [x] 26-01-PLAN.md — AgentEvent schema module (TDD) + protocol extension
113	- [x] 26-02-PLAN.md — Server route integration, hook scripts, E2E validation
114	
115	### Phase 27: MCP Server
116	**Goal**: Any MCP-capable LLM can autonomously read terminal output, query session history, and capture screenshots via standard MCP tools
117	**Depends on**: Phase 23, Phase 24, Phase 25
118	**Requirements**: LLM-01
119	**Success Criteria** (what must be TRUE):
120	  1. An MCP client (e.g., Claude Code with `.mcp.json` configured) can call `read_terminal_output` and receive the current terminal buffer
121	  2. An MCP client can call `query_session_history` and receive historical PTY output from the SQLite store
122	  3. An MCP client can call `capture_screenshot` and receive a PNG of the app window (blurred if the caller is a cloud provider)
123	  4. The MCP server starts via stdio transport and registers cleanly with no manual setup beyond the `.mcp.json` file
124	**Plans:** 1/1 plans complete
125	Plans:
126	- [x] 27-01-PLAN.md — MCP stdio server with 3 tool handlers (read_terminal_output, query_session_history, capture_screenshot)
127	
128	### Phase 28: Adapter Layer & Sidebar
129	**Goal**: Hook events from Claude Code, Windsurf, and Cursor are normalized through typed adapters, and structured agent activity is visible in the app UI
130	**Depends on**: Phase 26
131	**Requirements**: LLM-02, AGNT-03
132	**Success Criteria** (what must be TRUE):
133	  1. Hook events from Claude Code, Windsurf, and Cursor each pass through a dedicated adapter that maps tool-specific fields to the shared `AgentEvent` schema
134	  2. Unrecognized hook formats are handled by a FallbackAdapter that preserves the raw payload without crashing
135	  3. The app sidebar shows a list of recent agent events with tool name, file path (where applicable), and a status indicator (running/complete/error)
136	  4. The sidebar can be collapsed and expanded without losing the accumulated event history for the current session
137	**Plans:** 2/2 plans complete
138	Plans:
139	- [x] 28-01-PLAN.md — Adapter layer: IAdapter interface, ClaudeCode/Windsurf/Cursor/Fallback adapters, selectAdapter factory, server.ts integration
140	- [x] 28-02-PLAN.md — Sidebar UI: Zustand agent event store, AgentSidebar component, PaneContainer/TerminalPane wiring
141	**UI hint**: yes
142	
143	### Phase 29: Auto-Configuration
144	**Goal**: Opening the app is all that is required — hook registration and MCP server access are configured automatically
145	**Depends on**: Phase 27, Phase 28
146	**Requirements**: AGNT-04
147	**Success Criteria** (what must be TRUE):
148	  1. On first launch after v1.6, the app writes hook configuration into `~/.claude/settings.json` (or equivalent) pointing to `POST /hook-event` without requiring any manual edit
149	  2. The MCP server entry is injected into the user's MCP config on startup so Claude Code discovers the tools automatically
150	  3. If the config files already contain the correct entries, startup does not duplicate or corrupt them
151	**Plans**: TBD
152	
153	## v1.7 Phase Details
154	
155	### Phase 30: LLM Settings Store
156	**Goal**: User-configurable LLM settings are persisted to localStorage and available to all v1.7 components before any LLM or TTS calls are made
157	**Depends on**: Phase 28 (sidebar infrastructure)
158	**Requirements**: SET-01, SET-02, SET-03, SET-04
159	**Success Criteria** (what must be TRUE):
160	  1. User can open the settings panel and select an Ollama model from a dropdown that is populated live from the Ollama /api/tags endpoint
161	  2. User can edit the PM system prompt in a textarea and the text survives an app restart
162	  3. User can move the temperature slider (0.0–1.0, default 0.0) and the value survives an app restart
163	  4. User can enter a custom Ollama endpoint URL and the value survives an app restart
164	  5. All four settings load from localStorage on startup so no value resets unexpectedly between sessions
165	**Plans**: TBD
166	**UI hint**: yes
167	
168	### Phase 31: Ollama Chat Backend & Sidebar Tab
169	**Goal**: User can send a message to the local Ollama LLM from a PM Chat sidebar tab and watch the response stream in real time, with clear feedback if Ollama is not running
170	**Depends on**: Phase 30
171	**Requirements**: CHAT-01, CHAT-04
172	**Success Criteria** (what must be TRUE):
173	  1. Sending a message from the PM Chat tab triggers a streaming POST to the sidecar's /pm-chat route, and response tokens appear in the UI as they arrive from Ollama /api/chat
174	  2. Opening the PM Chat sidebar tab triggers an Ollama health check; if Ollama is not running the tab shows a clear error state with instructions rather than a blank or broken UI
175	  3. The PM Chat tab coexists with the AgentSidebar tab as a separate selectable tab in the sidebar
176	  4. Streaming completes cleanly — no orphaned loading states if the connection is closed mid-stream
177	**Plans:** 1/2 plans executed
178	Plans:
179	- [x] 31-01-PLAN.md — Sidecar streaming proxy: protocol types, pmChat module (NDJSON streaming + health check + abort), server.ts WS wiring
180	- [ ] 31-02-PLAN.md — Frontend: pmChatStore Zustand store, PMChatTab component, AgentSidebar tab switcher, TerminalPane WS dispatch
181	**UI hint**: yes
182	
183	### Phase 32: Conversational Context
184	**Goal**: Every message the user sends automatically includes recent terminal output as context, and the LLM remembers the last 20 turns of conversation so follow-up questions work naturally
185	**Depends on**: Phase 31
186	**Requirements**: CHAT-02, CHAT-03
187	**Success Criteria** (what must be TRUE):
188	  1. Each outgoing message to Ollama includes the last N lines of terminal output (from TerminalBuffer) injected into the context without the user doing anything manually
189	  2. After receiving a response, the user can type a follow-up message and Ollama answers with awareness of the preceding exchange
190	  3. Conversation history is capped at 20 turns — the oldest turn is dropped when the cap is reached, and new messages continue to work normally
191	  4. Sending a message while a previous response is still streaming is blocked or queued — no duplicate in-flight requests
192	**Plans**: TBD
193	**UI hint**: yes
194	
195	### Phase 33: TTS Voice Engine
196	**Goal**: LLM responses are spoken aloud via Windows SAPI5 through a persistent PowerShell subprocess, with user controls for voice selection, speech rate, auto-speak toggle, and mid-utterance stop
197	**Depends on**: Phase 31
198	**Requirements**: TTS-01, TTS-02, TTS-03, TTS-04
199	**Success Criteria** (what must be TRUE):
200	  1. When a response arrives and auto-speak is on, the text is spoken aloud through the Windows voice (Hazel or Zira) via the persistent PowerShell SAPI5 process — no new process is spawned per utterance
201	  2. User can click a Stop button during speech and the current utterance stops immediately without affecting subsequent messages
202	  3. User can select voice (Hazel/Zira) and adjust speech rate in settings and the next utterance reflects the change
203	  4. User can toggle auto-speak off; with auto-speak off, responses are not spoken unless the user explicitly triggers speech
204	  5. LLM response text is sent to the PowerShell process via stdin pipe only — it is never interpolated into a shell command string
205	**Plans**: TBD
206	**UI hint**: yes
207	
208	## Progress
209	
210	| Phase | Milestone | Plans Complete | Status | Completed |
211	|-------|-----------|----------------|--------|-----------|
212	| 1-5 | v1.0 | 11/11 | Complete | 2026-03-28 |
213	| 6 | v1.1 | 2/2 | Complete | 2026-03-30 |
214	| 7-9 | v1.1 | — | Superseded by v1.2 | — |
215	| 10-15 | v1.2 | 9/9 | Complete | 2026-03-30 |
216	| 16-20 | v1.3 | 7/7 | Complete | 2026-03-31 |
217	| 21-22 | v1.4 | 4/4 | Complete | 2026-03-31 |
218	| 23-25 | v1.5 | 7/7 | Complete | 2026-04-01 |
219	| 26. Hook Receiver & Event Schema | v1.6 | 2/2 | Complete | 2026-04-01 |
220	| 27. MCP Server | v1.6 | 1/1 | Complete | 2026-04-01 |
221	| 28. Adapter Layer & Sidebar | v1.6 | 2/2 | Complete | 2026-04-01 |
222	| 29. Auto-Configuration | v1.6 | 0/TBD | Not started | - |
223	| 30. LLM Settings Store | v1.7 | 0/TBD | Not started | - |
224	| 31. Ollama Chat Backend & Sidebar Tab | v1.7 | 0/2 | Planned | - |
225	| 32. Conversational Context | v1.7 | 0/TBD | Not started | - |
226	| 33. TTS Voice Engine | v1.7 | 0/TBD | Not started | - |
227	
228	---
229	*Full phase details archived in `.planning/milestones/`*
