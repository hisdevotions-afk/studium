# Studium lookup backend

FastAPI service exposing `POST /lookup` — takes the extension's `LookupPayload`,
asks an LLM (via OpenRouter) for a short pt-BR explanation of the clicked word
in its subtitle context, and returns an `Explanation`. Mirrors the client
contract in `src/adapter/types.ts`.

## Run

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then put your OPENROUTER_API_KEY in .env
uvicorn main:app --reload --port 8000
```

The extension's `explainLookup` POSTs to `http://localhost:8000/lookup`
(`src/lookup/explain-lookup.ts`), and the manifest grants that host permission.

## Test

```bash
pytest
```
