# AGENTS.md

AI chat + image-generation platform: DeepSeek Flash chat, Seedream 5.0 Lite image generation, with per-user quotas, an admin-moderated gallery, a prompt marketplace, and AI skills.

## Repository layout

- `backend/` — FastAPI + SQLAlchemy (SQLite) + Pydantic v2
- `frontend/` — React 18 + TypeScript + Vite; axios + zustand + TanStack Query; Tailwind (shadcn-style, `components.json`)
- `docs/` — teaching and reference docs. Images build via `docker-compose.yml` + `.github/workflows/` and push to ghcr.io on push to `main` or `v*` tags.

## Commands

Backend (from `backend/`):

```bash
mkdir -p data        # required: importing app.main runs create_all on ./data/app.db — no dir, crash
pip install -r requirements.txt
uvicorn app.main:app --reload       # API docs at http://localhost:8000/docs
python -m pytest tests/ -v          # full suite (pytest + unittest styles; pytest collects both)
```

Frontend (from `frontend/`):

```bash
npm run dev      # http://localhost:5173; vite proxies /api → :8000 (rewrite strips the prefix)
npm run build    # tsc && vite build
npm run lint     # eslint, max-warnings 0
```

## Backend conventions

- **Layering**: `app/api` (thin routes) → `app/services` (business logic) → `app/models` (SQLAlchemy models + Pydantic schemas in `schemas.py`); `app/core` holds config / database / security / deps.
- **Auth**: JWT (`HTTPBearer`). Every endpoint depends on `get_current_user`; admin endpoints use `get_current_admin`.
- **Ownership red line**: queries for the current user's resources must carry `user_id == current_user.id`; otherwise treat as 404 — a resource that doesn't exist and one that isn't yours are equivalent.
- **Quota**: check `used >= quota` (403) before calling the model, then `used += 1` on success; admins adjust via the admin endpoints.
- **Database**: SQLite WAL + busy_timeout (pragmas in `core/database.py`); tables are created automatically when `app.main` imports; the default admin and builtin prompts are seeded idempotently at startup, checked by name one by one.
- **Error handling**: business errors raise `HTTPException` with a Chinese `detail`; the global handler in `app.main` logs traceback + traceId and returns a friendly message only. Log with `logging.getLogger(__name__)`; when calling external APIs, log sanitized facts (counts/lengths) plus the error response body.
- **Message flow** (`send_message` in `api/chat.py`): persist the user message → take the last 10 history messages → prepend `system_prompt` if set → with skills enabled run `run_chat_with_skills`, otherwise `chat_with_deepseek` → persist the assistant message (with `tokens_used`, `tool_calls`) → bump quota. With `web_search=true`, search live via DDGS; results ride on the response and are never persisted.

## Skills (function calling)

Skills are controlled tools loaded onto the LLM: the model passes arguments via function calling, the backend runs whitelisted operations and feeds results back. To add a skill:

1. Create a file in `backend/app/skills/` inheriting `BaseSkill`, implementing `name` / `description` / `parameters` (JSON Schema) / `execute`;
2. Import it in `app/skills/__init__.py` and call `SKILL_REGISTRY.register(...)`;
3. Add tests (see `tests/test_skills.py`: `asyncio.run` + a mock replacing `chat_with_deepseek`; no real API key).

Red lines:

- **No silent fallbacks**: `execute` must raise on missing or invalid arguments — never invent defaults for hallucinated arguments; the registry also raises explicitly on name clashes and unregistered skills.
- A session with empty `enabled_skills` takes the plain path (no tools); `run_chat_with_skills` caps the loop at `MAX_ITERATIONS = 5`, then returns the fallback message and stops.

## Frontend conventions

- All requests go through `src/services/api.ts` (baseURL `/api`; interceptor adds the `Bearer` token; on 401 it clears authStore and redirects to `/login`).
- State via zustand (`store/authStore.ts`); server data via TanStack Query; shared utilities in `src/utils/`.
- Pages in `src/pages/`, shared components in `src/components/`; the `@` alias points at `src`.

## Style

- Code comments and commit messages are written in Chinese; commits use conventional prefixes (`feat:` / `fix:` / `refactor:`).
- Endpoints declare `response_model` (a Pydantic schema), returning schema instances or matching dicts.
- Frontend components follow the shadcn system: className via cva / clsx / tailwind-merge, icons via lucide-react.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles with the default label strings (`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`, created lazily by `/domain-modeling`. See `docs/agents/domain.md`.