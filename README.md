# DocGenix

**AI-powered software project blueprint generator.** Describe your idea, get back a full set of production-ready documentation — requirements, architecture, data model, API spec, DevOps pipeline, testing strategy, and a React UI starter — in minutes.

---

## Features

- **AI Interview** — conversational agent gathers project name, platform, features, tech stack, and audience before generating anything
- **8 Parallel Doc Agents** — each specialist agent produces one artifact: Project Overview, Requirements, User Stories, System Architecture, API Spec, Data Model, DevOps & Deployment, Testing Strategy
- **Critic Loop** — a reviewer agent checks every document and triggers targeted revisions (up to 2 rounds) before surfacing results
- **Live Diagrams** — System Architecture renders as an interactive 3D force graph; Data Model renders as a ReactFlow ER diagram
- **Generate UI** — Gemini calls a `stitch` tool that assembles all project context and generates React + Tailwind starter components for the key screens
- **Document Editing** — edit any generated document inline and save back to the database
- **Per-agent Regeneration** — re-run any single agent without touching the rest
- **Share & Export** — download a ZIP containing all markdown docs + diagram PNG images

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Diagrams | `react-force-graph-3d` (Three.js), `@xyflow/react` (ReactFlow) |
| Backend | Python, FastAPI, uvicorn |
| AI Orchestration | LangChain, LangGraph (ReAct agents) |
| LLM — Agents | ASI:One Premium API (`asi1` model) |
| LLM — UI Gen | Google Gemini API (`gemini-2.0-flash`) |
| Web Search | DuckDuckGo Search (DDGS) |
| Agent Network | Fetch.ai Agentverse (`fetchai`, `uagents-core`) |
| Database | SQLite via `aiosqlite` |
| Streaming | Server-Sent Events (SSE) |
| Export | JSZip, `html-to-image` |

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- An [ASI:One](https://asi1.ai) API key
- A [Google AI Studio](https://aistudio.google.com) API key (for UI generation)

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Copy and fill in the environment file:

```bash
cp .env.example .env   # or edit .env directly
```

Start the server:

```bash
uvicorn main:app --reload --port 1000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

All variables live in `backend/.env`.

| Variable | Required | Description |
|---|---|---|
| `ASI1_API_KEY` | ✅ | ASI:One Premium API key |
| `ASI1_BASE_URL` | ✅ | ASI:One base URL (default: `https://api.asi1.ai/v1`) |
| `ASI1_MODEL` | ✅ | Model name (default: `asi1`) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key (for Generate UI) |
| `GEMINI_MODEL` | | Gemini model (default: `gemini-2.0-flash`) |
| `AGENTVERSE_API_KEY` | | Fetch.ai Agentverse JWT token |
| `AGENT_SEED` | | Seed for deterministic agent identity |
| `STITCH_API_KEY` | | Fetch.ai Stitch agent API key |

---

## Project Structure

```
DocGenix/
├── backend/
│   ├── agents/
│   │   ├── base.py              # BaseAgent (ReAct + LangGraph)
│   │   ├── architecture.py      # System Architecture agent
│   │   ├── data_model.py        # Data Model agent
│   │   ├── critic.py            # Critic / reviewer agent
│   │   ├── ui_gen.py            # Gemini UI generation + stitch tool
│   │   └── ...                  # 5 other doc agents
│   ├── services/
│   │   ├── generation.py        # Agent orchestration, critic loop, graph extraction
│   │   ├── chat.py              # Chat streaming service
│   │   └── ui_gen.py            # UI generation service
│   ├── routes/
│   │   ├── generation.py        # POST /generate
│   │   ├── chat.py              # POST /chat
│   │   ├── projects.py          # CRUD + export
│   │   └── ui_gen.py            # POST /generate-ui
│   ├── models/
│   │   ├── database.py          # SQLite async helpers
│   │   └── schemas.py           # Pydantic request/response models
│   ├── tools/
│   │   └── web_search.py        # DuckDuckGo search tool
│   ├── utils/
│   │   ├── sse.py               # SSE frame formatter
│   │   └── doc_agents.py        # Agent factory
│   ├── main.py                  # FastAPI app + lifespan
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── app/
    │   ├── page.tsx             # Landing / project selection
    │   ├── app/
    │   │   └── page.tsx         # Main workspace (3-panel layout)
    │   └── components/
    │       ├── ArchitectureDiagram.tsx   # 3D force graph (Three.js)
    │       └── ERDiagram.tsx             # ER diagram (ReactFlow)
    └── package.json
```

---

## How It Works

1. **User describes their idea** on the landing page and is routed to the workspace.
2. **Chat agent** (right panel) interviews the user to extract five key fields: project name, platform, features, tech stack, audience.
3. Once context is complete, **"Run All Agents"** launches 8 specialist agents in parallel via `POST /generate` (streamed over SSE).
4. Each agent uses web search to ground its output, then produces a structured markdown document.
5. A **Critic agent** reviews all documents and requests targeted revisions if needed (max 2 rounds).
6. **Graph extraction** parses the Architecture and Data Model outputs into node/edge JSON immediately after each agent completes — no extra LLM call required.
7. **"Generate UI"** sends the project context to Gemini via `POST /generate-ui`; Gemini calls the `stitch` tool to assemble docs, then returns React + Tailwind components.
8. **Download ZIP** exports all markdown docs plus PNG screenshots of both diagrams.
