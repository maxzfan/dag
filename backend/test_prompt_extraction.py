#!/usr/bin/env python3
"""
Test script to demonstrate prompt extraction from YAML
"""

import sys
from pathlib import Path

# Add the backend directory to the path
sys.path.append(str(Path(__file__).parent))

from voice_server import _extract_prompts_from_yaml

# Sample YAML with prompts
sample_yaml = """
agent:
  name: "weather_monitor"
  description: "Monitors weather conditions and sends alerts"

prompts:
  journal: |
    You are a problem detection system. Analyze user input to identify problems that could benefit from automation.
    Look for repetitive tasks, manual processes, or issues that could be solved with AI agents.
    
    If you detect a problem, respond with a JSON object:
    {"type": "ProblemBrief", "description": "Brief description", "category": "automation"}
    
    Otherwise, provide a helpful summary of the user's input.

  detail: |
    You are a requirements gathering system. Based on the problem brief, ask clarifying questions
    to understand the specific requirements for an automated solution.
    
    Focus on:
    - What triggers the problem
    - What actions need to be taken
    - How often it occurs
    - What data is involved
    
    Return either a follow-up question or a detailed specification.

  yaml: |
    You are a YAML generator for Fetch.ai agents. Create a complete YAML configuration
    that defines an agent capable of solving the described problem.
    
    Include:
    - Agent configuration
    - Protocols and message types
    - Integration settings
    - Deployment configuration
    
    Return only the YAML content.

integrations:
  llm:
    provider: "openrouter"
    model: "anthropic/claude-3-5-sonnet"
"""

def test_prompt_extraction():
    print("Testing prompt extraction from YAML...")
    
    # Extract prompts
    extracted = _extract_prompts_from_yaml(sample_yaml)
    
    print(f"Extracted prompts: {list(extracted.keys())}")
    
    # Check if prompts were extracted
    if extracted:
        print("\n✅ Successfully extracted prompts from YAML!")
        for key, value in extracted.items():
            print(f"  {key}: {len(value)} characters")
    else:
        print("\n❌ No prompts found in YAML")
    
    return extracted

if __name__ == "__main__":
    test_prompt_extraction()
