import re
import requests
from datetime import datetime, timezone


def _is_problem_heuristic(text: str) -> bool:
    """
    Enhanced heuristic to detect problems suitable for automation.
    Requires multiple indicators to reduce false positives.
    """
    if not text:
        return False
    
    t = text.lower()
    
    # Problem indicators (must have at least 2 different categories)
    failure_keywords = ["fail", "error", "crash", "broken", "timeout", "exception", "http 5", "http 4"]
    repetitive_keywords = ["every time", "keep having to", "repetitive", "manual", "constantly", "always", "repeatedly"]
    blocked_keywords = ["stuck", "can't", "blocked", "unable to", "preventing me from"]
    reliability_keywords = ["flaky", "randomly fails", "too slow", "unreliable", "intermittent"]
    automation_keywords = ["alert", "monitor", "automate", "notify", "watch for", "set up alerts"]
    time_waste_keywords = ["takes forever", "waste time", "spend hours", "tedious", "annoying"]
    
    # Count indicators by category
    categories_found = 0
    if any(k in t for k in failure_keywords):
        categories_found += 1
    if any(k in t for k in repetitive_keywords):
        categories_found += 1
    if any(k in t for k in blocked_keywords):
        categories_found += 1
    if any(k in t for k in reliability_keywords):
        categories_found += 1
    if any(k in t for k in automation_keywords):
        categories_found += 1
    if any(k in t for k in time_waste_keywords):
        categories_found += 1
    
    # Require at least 2 different problem categories to reduce false positives
    return categories_found >= 2


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


def run_journal(user_text: str, prompt_journal: str | None, openrouter_api_key: str, openrouter_url: str, logger=None) -> tuple[str, dict | None, str | None]:
    """
    Enhanced journal processing that either summarizes or generates YAML directly.
    
    Returns:
        - summary_text: Sentence summary for normal entries, or problem acknowledgment
        - problem_brief: ProblemBrief dict if problem detected, None otherwise  
        - yaml_content: Generated YAML if problem detected and YAML generated, None otherwise
    """
    if not prompt_journal:
        return "Noted.", None, None
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
        if brief and isinstance(brief, dict) and brief.get("type") == "ProblemBrief" and _is_problem_heuristic(user_text):
            # Problem detected - generate YAML directly
            try:
                from yaml_helper import run_yaml
                # Create a basic detail spec from the problem brief for YAML generation
                detail_spec = {
                    "problem_summary": brief.get("summary", ""),
                    "category": brief.get("category", "other"),
                    "signals": brief.get("signals", []),
                    "user_context": user_text
                }
                
                # Load the YAML prompt
                from pathlib import Path
                yaml_prompt = Path(__file__).with_name("prompt_yaml.md").read_text(encoding="utf-8")
                
                missing_info, yaml_text = run_yaml(
                    detail_spec,
                    yaml_prompt,
                    openrouter_api_key,
                    openrouter_url,
                    logger=logger,
                )
                
                if yaml_text:
                    return "I detected a problem and generated an AI agent configuration for you.", brief, yaml_text
                else:
                    return "I detected a problem worth automating. I'll need a few more details to generate the agent.", brief, None
            except Exception as e:
                if logger:
                    logger.error(f"YAML generation error: {e}")
                return "I detected a problem worth automating. I'll dig into details.", brief, None
        
        # No problem detected - return sentence summary
        sanitized = re.sub(r"```[\s\S]*?```", "", content).strip()
        lines = [ln.strip() for ln in sanitized.splitlines() if ln.strip()]
        _log(f"run_journal: sanitized_len={len(sanitized)} lines_count={len(lines)}")
        if not lines:
            return "Noted.", None, None
        
        # Convert bullet points to sentence format
        if lines[0].startswith('- '):
            # Convert bullet points to a sentence
            bullet_text = ' '.join([line[2:] for line in lines[:3]])  # Remove '- ' prefix
            sentence_summary = bullet_text.capitalize() + "."
        else:
            sentence_summary = lines[0]
        
        return sentence_summary, None, None
    except Exception as e:
        if logger:
            logger.error(f"Journal model error: {e}")
        return "Noted.", None, None
