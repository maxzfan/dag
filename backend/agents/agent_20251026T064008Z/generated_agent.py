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
    name="github_monitor",
    seed="github_monitor_seed_2024",
    port=8000,
    endpoint=["http://localhost:8000"],
)

class HealthCheckRequest(Model):
    service: str
    endpoint: str


class HealthCheckResponse(Model):
    service: str
    status: str
    timestamp: int
    response_time: float

github_monitor_protocol = Protocol("github_monitor_protocol")


@github_monitor_protocol.on_message(model=HealthCheckRequest)
async def handle_healthcheckrequest(ctx: Context, sender: str, msg: HealthCheckRequest):
    ctx.logger.info(f"Received {msg.__class__.__name__} from {sender}")
    
    # TODO: Implement your logic here
    # This is a mock response - replace with your actual logic
    import time
    
    response = HealthCheckResponse(
        service="mock_service",
        status="mock_status",
        timestamp=int(time.time()),
        response_time=0.0,
    )
    
    ctx.logger.info(f"Sending {response.__class__.__name__} to {sender}")
    await ctx.send(sender, response)

agent.include(github_monitor_protocol)

@agent.on_interval(period=30.0)
async def monitor_github_resources(ctx: Context):
    """
    Monitors GitHub API service status and workflow runs, sends alerts to Slack if issues detected
    """
    ctx.logger.info("Running monitor_github_resources...")
    
    # TODO: Implement your periodic task logic here
    # Access storage: ctx.storage.get("key")
    # Update storage: ctx.storage.set("key", value)

@agent.on_event("startup")
async def startup(ctx: Context):
    ctx.logger.info(f"Agent {agent.name} starting up...")
    ctx.logger.info(f"Agent address: {agent.address}")

    # Initialize storage
    ctx.storage.set("last_check", {})


if __name__ == "__main__":
    agent.run()
