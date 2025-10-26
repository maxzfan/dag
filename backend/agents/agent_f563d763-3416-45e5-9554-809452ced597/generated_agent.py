from uagents import Agent, Context, Model
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
    name="weather-uptime-monitor",
    seed="weather2024secure8x9yn4",
    port=8000,
    endpoint=["http://localhost:8000"],
)

@agent.on_interval(period=300)
async def monitor_endpoints(ctx: Context):
    """
    Monitors weather website uptime every 5 minutes
    """
    ctx.logger.info("Running monitor_endpoints...")
    
    # TODO: Implement your periodic task logic here
    # Access storage: ctx.storage.get("key")
    # Update storage: ctx.storage.set("key", value)

@agent.on_event("startup")
async def startup(ctx: Context):
    ctx.logger.info(f"Agent {agent.name} starting up...")
    ctx.logger.info(f"Agent address: {agent.address}")

    # Initialize storage
    ctx.storage.set("last_check", {})
    ctx.storage.set("failure_count", {})
    ctx.storage.set("last_alert_sent", {})
    ctx.storage.set("alert_cooldown", {})
    ctx.storage.set("uptime_percentage", {})


if __name__ == "__main__":
    agent.run()
