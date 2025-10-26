# Project Architecture

## Overview

This application is a voice-first AI assistant that captures user input (voice or text), analyzes it for journaling vs. automation opportunities, and when appropriate, generates and prepares a Fetch.ai agent from AI-produced YAML. The backend is a Flask server that orchestrates conversation state, integrates with external AI and TTS/STT services, and manages generated artifacts.

Complementary doc: see SYSTEM_ARCHITECTURE.md for an end-to-end, higher-level view. This document focuses on the code in this repository and concrete module interactions.

## Key Components

- **Flask Backend** (`backend/voice_server.py`)
  - HTTP API endpoints for conversation, TTS, STT, journal entry management, and agent lifecycle operations.
  - Orchestrator state machine controlling phases: `detail` and `yaml`, with problem detection triggering transitions.
  - Integrates with journal/detail/yaml helpers and external services.

- **Journal Processing** (`backend/journal.py`)
  - Calls LLM with `prompt_journal.md` to classify/summarize input.
  - Detects structured ProblemBrief JSON from fenced code blocks.
  - Applies `_is_problem_heuristic` to gate problem mode.
  - When a problem is detected, routes to YAML generation path.

- **Detail Gathering** (`backend/detail.py`)
  - Uses `prompt_detail.md` to ask targeted questions and synthesize a `detail_spec` for YAML generation.

- **YAML Generation** (`backend/yaml_helper.py`)
  - Uses `prompt_yaml.md` to produce an agent YAML configuration.
  - Returns a `missing_info` prompt when information is insufficient.

- **Prompts** (`backend/prompt_*.md`)
  - `prompt_journal.md`: classify journal input vs. problem.
  - `prompt_detail.md`: gather missing requirements.
  - `prompt_yaml.md`: produce final agent YAML.

- **Data & Artifacts** (`backend/data/`)
  - Conversations stored as JSON: `conversation-<uuid>.json`.
  - Generated artifacts: `backend/data/generated/*.yaml`.

- **Voice Integration**
  - Fish Audio SDK for STT and TTS via `/speech-to-text` and `/text-to-speech` endpoints.

## Orchestration State Machine (voice_server)

- **State**
  - `phase`: `None | detail | yaml`
  - `pending_questions`: list of outstanding questions or next prompts
  - `problem_brief`: structured detection result from journal step
  - `detail_spec`: aggregate of user-provided details
  - `ready_yaml`: produced YAML when complete

- **Typical Flow**
  1. User message hits `/conversation`.
  2. `run_journal(...)` analyzes input.
     - If only journaling: returns a concise summary.
     - If `ProblemBrief` detected and heuristic passes: proceed to detail.
  3. `run_detail(...)` refines requirements; may queue follow-up questions.
  4. `run_yaml(...)` generates YAML or returns a `missing_info` question.
  5. When YAML is ready, backend can proceed to create/deploy an agent (via DAG tooling).

## Primary Endpoints (selected)

- `POST /conversation`
  - Input: `{ text: string, conversation_id?: string }`
  - Behavior: advances orchestration state, returns AI response text and state flags.

- `POST /speech-to-text`
  - Input: multipart/form-data with audio file.
  - Output: transcribed text.

- `POST /text-to-speech`
  - Input: `{ text: string }`
  - Output: path to generated audio file.

- `GET /journal-entries` / `DELETE /journal-entries/:id`
  - List and remove conversation files.

- `GET /agents`
  - Returns agents in memory (if implemented; may return 404 when not wired).

## External Services

- **OpenRouter (LLM)**
  - Model: e.g., `anthropic/claude-3-haiku` via `requests`.
  - URL and API key from environment.

- **Fish Audio (STT/TTS)**
  - Used in `/speech-to-text` and `/text-to-speech` flows.

## Configuration

- Environment variables (typically via `.env`):
  - `OPENROUTER_API_KEY`, `OPENROUTER_URL`
  - `FISH_AUDIO_API_KEY`

- Prompt files loaded at server start; hot-reload when Flask debug is on.

## Error Handling & Fallbacks

- Journal flow returns "Noted." when:
  - Prompt missing, empty/unsuitable model output after sanitization, or any exception.
- API/network errors are logged via `logger` in `voice_server.py` and try/except blocks in helpers.
- DNS or upstream failures can surface as generic fallbacks in responses.

## Data Model Snapshots

- Conversation JSON (example fields):
  - `id`, `title`, `messages[]`, `summary`, timestamps

- Orchestrator state (runtime only):
  - `phase`, `pending_questions`, `problem_brief`, `detail_spec`, `ready_yaml`

## Directory Structure (selected)

```
backend/
  voice_server.py        # Flask app and orchestration
  journal.py             # Journal classification/summarization
  detail.py              # Clarification Q&A and spec building
  yaml_helper.py         # YAML generation wrapper
  prompt_journal.md      # LLM prompt: journal
  prompt_detail.md       # LLM prompt: detail
  prompt_yaml.md         # LLM prompt: YAML
  data/
    generated/           # Generated YAML outputs
    conversation-*.json  # Conversation logs
SYSTEM_ARCHITECTURE.md   # High-level architecture doc
ARCHITECTURE.md          # This file
```

## Development Notes

- Start backend: `python backend/voice_server.py`
- Backend runs on `http://127.0.0.1:5001` in debug during development.
- Frontend (if present) proxies to backend; see SYSTEM_ARCHITECTURE.md for details.

## Future Enhancements

- Add retry/backoff on LLM calls.
- Branch-specific logging for journal fallbacks.
- Persist agents in a DB; wire up `/agents` list/create endpoints.
- Replace development server with production WSGI if deploying.
