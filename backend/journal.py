import re
import requests
from datetime import datetime, timezone


"""def _is_problem_heuristic(text: str) -> bool:
    if not text:
        return False
    t = text.lower()
    keywords = [
        "fail", "error", "crash", "broken", "stuck", "blocked", "flaky", "randomly fails",
        "too slow", "slow", "alert", "monitor", "automate", "notify", "repetitive", "manual",
        "every time", "keep having to"
    ]
    return any(k in t for k in keywords)"""


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


def run_journal(user_text: str, prompt_journal: str | None, openrouter_api_key: str, openrouter_url: str, logger=None) -> tuple[str, dict | None]:
    def _log(m):
        try:
            (logger.info(m) if logger else print(m))
        except Exception:
            pass
    if not prompt_journal:
        _log("run_journal: Noted due to missing prompt_journal")
        return "Noted.", None
    try:
        content = _call_model_with_system(
            prompt_journal,
            user_text,
            model="anthropic/claude-3-haiku",
            max_tokens=400,
            temperature=0.1,
            openrouter_api_key=openrouter_api_key,
            openrouter_url=openrouter_url,
        )
        if content is None:
            _log("run_journal: content is None")
        else:
            _log(f"run_journal: content_len={len(content)} preview={repr(content[:300])}")
        brief = _extract_json_from_fence(content)
        if brief and isinstance(brief, dict) and brief.get("type") == "ProblemBrief":
            _log("run_journal: Detected ProblemBrief JSON; forwarding to Detail")
            return "I detected a problem worth automating. I'll dig into details.", brief
        sanitized = re.sub(r"```[\s\S]*?```", "", content).strip()
        lines = [ln.strip() for ln in sanitized.splitlines() if ln.strip()]
        _log(f"run_journal: sanitized_len={len(sanitized)} lines_count={len(lines)}")
        if not lines:
            _log(f"run_journal: Noted due to empty lines after sanitization preview={repr(sanitized[:300])}")
            return "Noted.", None
        lines = lines[:3]
        summary = "\n".join(lines)
        summary = summary.replace("```", "")
        return summary, None
    except Exception as e:
        if logger:
            logger.error(f"Journal model error: {e}")
        else:
            print(f"Journal model error: {e}")
        _log("run_journal: Noted due to exception")
        return "Noted.", None
