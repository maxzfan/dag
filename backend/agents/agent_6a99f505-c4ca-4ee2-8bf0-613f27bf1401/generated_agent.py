from uagents import Agent, Context, Model
from uagents import Protocol
from typing import Dict, List, Any
import os
import asyncio
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
import time

# Create the agent
agent = Agent(
    name="website_health_monitor",
    seed="website monitoring agent seed phrase 123",
    port=8000,
    endpoint=["http://localhost:8000"],
)

monitoring_protocol = Protocol("monitoring_protocol")

agent.include(monitoring_protocol)

@agent.on_interval(period=300)
async def monitor_website(ctx: Context):
    """
    Checks if website is responding with 200 status code and sends alerts on failure
    """
    ctx.logger.info("Running monitor_website...")
    
    # TODO: Implement your periodic task logic here
    # Access storage: ctx.storage.get("key")
    # Update storage: ctx.storage.set("key", value)

@agent.on_event("startup")
async def startup(ctx: Context):
    ctx.logger.info(f"Agent {agent.name} starting up...")
    ctx.logger.info(f"Agent address: {agent.address}")

    # Initialize storage
    ctx.storage.set("last_check_status", {})
    ctx.storage.set("failure_count", {})
    ctx.storage.set("last_alert_sent", {})


if __name__ == "__main__":
    agent.run()
