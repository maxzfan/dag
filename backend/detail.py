import re
import requests


def _extract_json_from_fence(text: str):
    try:
        m = re.search(r"```json\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
        if not m:
            return None
        import json as _json
        return _json.loads(m.group(1))
    except Exception:
        return None


def _call_model_with_system(system_prompt: str, user_content: str, *, model: str, max_tokens: int, temperature: float = 0.2,
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


def run_detail(problem_brief: dict, recent_user: str, current_spec: dict | None,
               prompt_detail: str | None, openrouter_api_key: str, openrouter_url: str, logger=None) -> tuple[str | None, dict | None]:
    if not prompt_detail:
        return None, None
    try:
        import json as _json
        pieces = [
            "ProblemBrief:",
            _json.dumps(problem_brief, ensure_ascii=False),
        ]
        if current_spec:
            pieces += ["Current DetailSpec:", _json.dumps(current_spec, ensure_ascii=False)]
        if recent_user:
            pieces += ["Recent user message:", recent_user]
        input_text = "\n".join(pieces)
        content = _call_model_with_system(
            prompt_detail,
            input_text,
            model="anthropic/claude-3-haiku",
            max_tokens=700,
            openrouter_api_key=openrouter_api_key,
            openrouter_url=openrouter_url,
        )
        obj = _extract_json_from_fence(content)
        if obj and isinstance(obj, dict):
            if obj.get("type") == "FollowUpQuestion":
                qs = obj.get("questions") or []
                question_text = qs[0] if qs else "Could you share more details?"
                return question_text, None
            if obj.get("type") == "DetailSpec":
                return None, obj
        return content.strip(), None
    except Exception as e:
        if logger:
            logger.error(f"Detail model error: {e}")
        return "Could you clarify a couple details (service, frequency, action)?", None
