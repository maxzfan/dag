import re
import requests


def _extract_yaml_from_fence(text: str) -> str | None:
    m = re.search(r"```yaml\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return None


def _extract_json_from_fence(text: str):
    try:
        m = re.search(r"```json\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
        if not m:
            return None
        import json as _json
        return _json.loads(m.group(1))
    except Exception:
        return None


def _call_model_with_system(system_prompt: str, user_content: str, *, model: str, max_tokens: int, temperature: float,
                             openrouter_api_key: str, openrouter_url: str) -> str:
    headers = {
        "Authorization": f"Bearer {openrouter_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    resp = requests.post(openrouter_url, headers=headers, json=payload)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]

def run_yaml(detail_spec: dict, prompt_yaml: str | None, openrouter_api_key: str, openrouter_url: str, logger=None) -> tuple[str | None, str | None]:
    if not prompt_yaml:
        return None, None
    try:
        import json as _json
        input_text = _json.dumps(detail_spec, ensure_ascii=False)
        content = _call_model_with_system(
            prompt_yaml,
            input_text,
            model="anthropic/claude-3-5-sonnet",
            max_tokens=1600,
            temperature=0.0,
            openrouter_api_key=openrouter_api_key,
            openrouter_url=openrouter_url,
        )
        yaml_text = _extract_yaml_from_fence(content)
        if yaml_text:
            return None, yaml_text
        obj = _extract_json_from_fence(content)
        if obj and isinstance(obj, dict) and obj.get("type") == "MissingInfoRequest":
            qs = obj.get("questions") or []
            question_text = qs[0] if qs else "I need one more detail to finalize the YAML."
            return question_text, None
        return None, content.strip()
    except Exception as e:
        if logger:
            logger.error(f"YAML model error: {e}")
        return "I need one more detail to finalize the YAML (service, schedule, or actions).", None
