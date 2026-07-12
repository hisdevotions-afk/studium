"""Studium lookup backend.

POST /lookup takes the extension's LookupPayload (camelCase, matching
src/adapter/types.ts) and returns an Explanation, asking an LLM via OpenRouter
(OpenAI-compatible API) for a short pt-BR explanation of the clicked word in
its subtitle context.
"""

import json
import os

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
# Default is a free OpenRouter model so a zero-credit key works out of the box.
# Free models are rate-limited (frequent 429s); for reliability add OpenRouter
# credit and set OPENROUTER_MODEL to a paid model (e.g. anthropic/claude-3.5-haiku).
MODEL = os.environ.get("OPENROUTER_MODEL", "tencent/hy3:free")

app = FastAPI(title="Studium lookup")
# Local dev backend; the extension calls from a chrome-extension:// origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class LookupPayload(BaseModel):
    videoId: int
    timestampBucket: float
    sentence: str
    clickedSpan: str
    targetLang: str
    nativeLang: str


class Explanation(BaseModel):
    translation: str
    contextualExplanation: str
    isIdiom: bool
    morphologyNote: str | None = None


LANG_NAMES = {"en": "inglês", "it": "italiano"}

SYSTEM = (
    "Você é um tutor de idiomas para um falante nativo de português do Brasil. "
    "Explique a palavra ou expressão que o usuário clicou, dentro do contexto da "
    "frase da legenda. Responda SEMPRE em português do Brasil, de forma curta e "
    "direta. Retorne SOMENTE um objeto JSON com as chaves: translation (tradução "
    "curta no contexto), contextualExplanation (1-2 frases sobre o sentido aqui), "
    "isIdiom (true se for gíria/expressão idiomática), morphologyNote (nota "
    "gramatical breve ou null)."
)


def build_prompt(p: LookupPayload) -> str:
    lang = LANG_NAMES.get(p.targetLang, p.targetLang)
    return (
        f'Idioma-alvo: {lang}. Frase da legenda: "{p.sentence}". '
        f'Palavra/trecho clicado: "{p.clickedSpan}".'
    )


def parse_json_object(content: str) -> dict:
    # Models sometimes wrap JSON in prose or ```json fences; grab the object.
    start, end = content.find("{"), content.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in LLM response")
    return json.loads(content[start : end + 1])


async def call_llm(payload: LookupPayload) -> Explanation:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not set")
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": build_prompt(payload)},
        ],
    }
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            OPENROUTER_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json=body,
        )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    data = parse_json_object(content)
    return Explanation(
        translation=data.get("translation", ""),
        contextualExplanation=data.get("contextualExplanation", ""),
        isIdiom=bool(data.get("isIdiom", False)),
        morphologyNote=data.get("morphologyNote"),
    )


@app.post("/lookup", response_model=Explanation)
async def lookup(payload: LookupPayload) -> Explanation:
    try:
        return await call_llm(payload)
    except HTTPException:
        raise
    except Exception as exc:  # never leak upstream internals to the client
        raise HTTPException(status_code=502, detail="lookup failed") from exc
