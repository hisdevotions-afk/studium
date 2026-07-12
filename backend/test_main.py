from fastapi.testclient import TestClient

import main

client = TestClient(main.app)

PAYLOAD = {
    "videoId": 99999,
    "timestampBucket": 8.5,
    "sentence": "be into someone",
    "clickedSpan": "into",
    "targetLang": "en",
    "nativeLang": "pt-BR",
}


def test_lookup_maps_llm_result(monkeypatch):
    async def fake(payload):
        assert payload.clickedSpan == "into"
        return main.Explanation(
            translation="a fim de",
            contextualExplanation="aqui indica interesse por alguém.",
            isIdiom=True,
            morphologyNote=None,
        )

    monkeypatch.setattr(main, "call_llm", fake)
    r = client.post("/lookup", json=PAYLOAD)
    assert r.status_code == 200
    assert r.json() == {
        "translation": "a fim de",
        "contextualExplanation": "aqui indica interesse por alguém.",
        "isIdiom": True,
        "morphologyNote": None,
    }


def test_lookup_returns_502_on_llm_failure(monkeypatch):
    async def boom(payload):
        raise RuntimeError("upstream down")

    monkeypatch.setattr(main, "call_llm", boom)
    r = client.post("/lookup", json=PAYLOAD)
    assert r.status_code == 502


def test_parse_json_object_strips_fences():
    assert main.parse_json_object('```json\n{"translation": "x"}\n```') == {
        "translation": "x"
    }
