"""Chat completions: an open LLM via Hugging Face Inference Providers, or a local Ollama model."""

import json

import httpx

from app.config import get_settings
from app.services.common import PipelineError
from app.services.hf import get_client, with_retries

Messages = list[dict[str, str]]


def chat(messages: Messages, *, max_tokens: int = 1200, temperature: float = 0.2, json_mode: bool = False) -> str:
    if get_settings().llm_backend == "ollama":
        return _ollama_chat(messages, max_tokens, temperature, json_mode)
    return _hf_chat(messages, max_tokens, temperature)


def _hf_chat(messages: Messages, max_tokens: int, temperature: float) -> str:
    s = get_settings()
    client = get_client()

    def call() -> str:
        resp = client.chat_completion(
            messages=messages, model=s.llm_model, max_tokens=max_tokens, temperature=temperature
        )
        return (resp.choices[0].message.content or "").strip()

    return with_retries(call, what="LLM request")


def _ollama_chat(messages: Messages, max_tokens: int, temperature: float, json_mode: bool) -> str:
    s = get_settings()
    payload: dict = {
        "model": s.ollama_model,
        "messages": messages,
        "stream": False,
        # Ollama's default context (2-4k tokens) would silently truncate a 1,500-word section.
        "options": {"num_predict": max_tokens, "temperature": temperature, "num_ctx": 8192},
    }
    if json_mode:
        payload["format"] = "json"  # constrained decoding -> always parseable JSON

    def call() -> str:
        try:
            r = httpx.post(f"{s.ollama_url.rstrip('/')}/api/chat", json=payload, timeout=s.llm_timeout)
        except httpx.ConnectError:
            raise PipelineError(f"Can't reach Ollama at {s.ollama_url}. Is it running? (`ollama serve`)") from None
        if r.status_code == 404:
            raise PipelineError(f"Ollama model '{s.ollama_model}' isn't installed: run `ollama pull {s.ollama_model}`.")
        r.raise_for_status()
        return (r.json().get("message", {}).get("content") or "").strip()

    return with_retries(call, what="LLM request (Ollama)", attempts=2)


def parse_json(raw: str):
    """Pull the first JSON object/array out of a model reply (tolerates fences and chatter)."""
    starts = [i for i in (raw.find("{"), raw.find("[")) if i != -1]
    if not starts:
        raise ValueError("no JSON found in model output")
    obj, _ = json.JSONDecoder().raw_decode(raw[min(starts):])
    return obj


def chat_json(messages: Messages, **kwargs):
    raw = chat(messages, json_mode=True, **kwargs)
    try:
        return parse_json(raw)
    except ValueError:
        retry = [
            *messages,
            {"role": "assistant", "content": raw},
            {"role": "user", "content": "That reply was not valid JSON. Reply again with only the JSON object."},
        ]
        return parse_json(chat(retry, json_mode=True, **kwargs))
