"""Gemini REST service. Key sirf .env se aata hai, kabhi log nahi hota.
Structured JSON ke liye responseMimeType + responseSchema use hota hai."""
import base64, json, time
import httpx
from ..core.config import settings

HOST = "https://generativelanguage.googleapis.com"

def _ssl_ctx():
    import ssl
    try:
        return ssl.create_default_context()  # system CA (kuch VMs par proxy ki custom CA system me hoti hai, certifi me nahi)
    except Exception:
        return True

def _proxy():
    import os
    # Hosting/VM par proxy env ho to use karo; college/local par None = direct.
    # trust_env=False isliye: kuch VMs ke NO_PROXY me IPv6 brackets hote hain jo httpx ko crash karte hain.
    return os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy") or None

def gemini_ready() -> bool:
    return bool(settings.gemini_api_key)

def _post(model: str, body: dict, timeout: float = 90) -> dict:
    url = f"{HOST}/v1beta/models/{model}:generateContent"
    headers = {"Content-Type": "application/json", "x-goog-api-key": settings.gemini_api_key}
    last = None
    for attempt in range(2):
        try:
            with httpx.Client(timeout=timeout, trust_env=False, proxy=_proxy(), verify=_ssl_ctx()) as c:
                r = c.post(url, json=body, headers=headers)
            if r.status_code in (429, 500, 503):
                last = RuntimeError(f"Gemini busy ({r.status_code})"); time.sleep(5 * (attempt + 1)); continue
            if r.status_code >= 400:
                raise RuntimeError(f"Gemini HTTP {r.status_code}: {r.text[:300]}")
            return r.json()
        except (httpx.TimeoutException, httpx.TransportError) as e:
            last = e; time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"Gemini unreachable: {last}")

def _text_of(payload: dict) -> str:
    parts = []
    for cand in payload.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            if "text" in part:
                parts.append(part["text"])
    return "".join(parts).strip()

FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"]

def _model_chain(model: str = None):
    chain = [model or settings.gemini_model] + FALLBACK_MODELS
    seen, out = set(), []
    for m in chain:
        if m not in seen:
            seen.add(m); out.append(m)
    return out

def generate_text(prompt: str, system: str = "", model: str = None) -> str:
    body = {"contents": [{"parts": [{"text": prompt}]}]}
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    last = None
    for m in _model_chain(model):
        try:
            return _text_of(_post(m, body))
        except Exception as e:
            last = e
    raise RuntimeError(f"Saare models busy/fail: {last}")

def generate_json(prompt: str, schema: dict, model: str = None) -> dict:
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "responseSchema": schema}}
    last = None
    for m in _model_chain(model):
        try:
            return json.loads(_text_of(_post(m, body)))
        except Exception as e:
            last = e
    raise RuntimeError(f"Saare models busy/fail: {last}")

def generate_json_with_file(prompt: str, schema: dict, file_bytes: bytes, mime: str, model: str = None) -> dict:
    b64 = base64.b64encode(file_bytes).decode()
    body = {"contents": [{"parts": [{"text": prompt}, {"inlineData": {"mimeType": mime, "data": b64}}]}],
            "generationConfig": {"responseMimeType": "application/json", "responseSchema": schema}}
    last = None
    for m in _model_chain(model):
        try:
            return json.loads(_text_of(_post(m, body, timeout=300)))
        except Exception as e:
            last = e
    raise RuntimeError(f"Saare models busy/fail: {last}")

def generate_text_with_file(prompt: str, file_bytes: bytes, mime: str, model: str = None) -> str:
    b64 = base64.b64encode(file_bytes).decode()
    body = {"contents": [{"parts": [{"text": prompt}, {"inlineData": {"mimeType": mime, "data": b64}}]}]}
    last = None
    for m in _model_chain(model):
        try:
            return _text_of(_post(m, body, timeout=300))
        except Exception as e:
            last = e
    raise RuntimeError(f"Saare models busy/fail: {last}")
