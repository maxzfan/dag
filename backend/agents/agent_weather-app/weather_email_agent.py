from uagents import Agent, Context, Model
import openai  # OpenRouter uses OpenAI SDK
from typing import Dict, List, Any
import os
import asyncio
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
import time

# LLM Integration Helper
class LLMHelper:
    def __init__(self):
        self.provider = "openrouter"
        self.model = "anthropic/claude-3.5-sonnet"
        api_key_env = "OPENROUTER_API_KEY"
        self.api_key = os.getenv(api_key_env)
        
        if not self.api_key:
            raise ValueError(f"Missing API key: {api_key_env}")
        
        self.base_url = "https://openrouter.ai/api/v1"
        self.client = openai.OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )
    
    async def call_llm(self, prompt: str, system_prompt: str = None, context: List[Dict] = None) -> str:
        """Call LLM via OpenRouter with given prompt"""
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        if context:
            messages.extend(context)
        
        messages.append({"role": "user", "content": prompt})
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=1000,
                extra_headers={
                    "HTTP-Referer": "https://fetch.ai",  # Optional: Replace with your site
                    "X-Title": "Fetch.ai Agent"  # Optional: Replace with your app name
                }
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error calling LLM via OpenRouter: {str(e)}"

llm_helper = LLMHelper()

# Create the agent
agent = Agent(
    name="weather_email_agent",
    seed="weather_email_agent_seed_2024",
    port=8003,
    endpoint=["http://localhost:8003/submit"],
)

@agent.on_interval(period=120.0)
async def check_weather_and_send_email(ctx: Context):
    """
    Fetch weather data from OpenWeather API, generate email with LLM, and send via SMTP
    """
    ctx.logger.info("Running check_weather_and_send_email...")
    
    import smtplib
    import os
    import requests
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from datetime import datetime

    # Get locations and recipients from storage
    locations = ctx.storage.get("locations")
    if not locations:
        locations = ["San Francisco", "New York", "Tokyo"]
        ctx.storage.set("locations", locations)

    recipients = ctx.storage.get("recipients")
    if not recipients:
        recipients = []
        ctx.logger.warning("No recipients configured! Add email addresses to 'recipients' storage.")
        ctx.storage.set("recipients", recipients)

    if not recipients:
        ctx.logger.info("Skipping email send - no recipients configured")
        return

    ctx.logger.info("\n" + "="*70)
    ctx.logger.info("WEATHER EMAIL GENERATION & SENDING")
    ctx.logger.info("="*70)

    # API and Email configuration from environment
    openweather_api_key = os.getenv("OPENWEATHER_API_KEY")
    smtp_server = "smtp.gmail.com"
    smtp_port = 587
    email_username = os.getenv("EMAIL_USERNAME")
    email_password = os.getenv("EMAIL_PASSWORD")
    from_address = os.getenv("EMAIL_FROM_ADDRESS", email_username)
    from_name = "Weather Alert Service"

    if not openweather_api_key:
        ctx.logger.error("OpenWeather API key not configured! Set OPENWEATHER_API_KEY environment variable.")
        return

    if not email_username or not email_password:
        ctx.logger.error("Email credentials not configured! Set EMAIL_USERNAME and EMAIL_PASSWORD environment variables.")
        return

    for location in locations:
        try:
            ctx.logger.info(f"\nProcessing location: {location}")

            # Fetch real weather data from OpenWeather API
            weather_url = f"https://api.openweathermap.org/data/2.5/weather"
            params = {
                "q": location,
                "appid": openweather_api_key,
                "units": "imperial"  # Use Fahrenheit
            }

            ctx.logger.info(f"Fetching weather data from OpenWeather API...")
            response = requests.get(weather_url, params=params, timeout=10)
            response.raise_for_status()

            weather_api_data = response.json()

            # Parse weather data
            weather_data = {
                "temperature": round(weather_api_data["main"]["temp"]),
                "feels_like": round(weather_api_data["main"]["feels_like"]),
                "conditions": weather_api_data["weather"][0]["description"].title(),
                "humidity": weather_api_data["main"]["humidity"],
                "wind_speed": round(weather_api_data["wind"]["speed"]),
                "pressure": weather_api_data["main"]["pressure"],
                "visibility": weather_api_data.get("visibility", 0) // 1000,  # Convert to km
                "location": weather_api_data["name"],
                "country": weather_api_data["sys"]["country"],
                "sunrise": datetime.fromtimestamp(weather_api_data["sys"]["sunrise"]).strftime("%I:%M %p"),
                "sunset": datetime.fromtimestamp(weather_api_data["sys"]["sunset"]).strftime("%I:%M %p")
            }

            # Add cloud coverage if available
            if "clouds" in weather_api_data:
                weather_data["cloud_coverage"] = weather_api_data["clouds"]["all"]

            # Add rain/snow data if available
            if "rain" in weather_api_data:
                weather_data["rain_1h"] = weather_api_data["rain"].get("1h", 0)
            if "snow" in weather_api_data:
                weather_data["snow_1h"] = weather_api_data["snow"].get("1h", 0)

            ctx.logger.info(f"Weather data received: {weather_data}")

            # Generate email using LLM
            prompt = f"""Create a weather update email for {weather_data['location']}, {weather_data['country']} with the following current weather data:

            Temperature: {weather_data['temperature']}°F (Feels like: {weather_data['feels_like']}°F)
            Conditions: {weather_data['conditions']}
            Humidity: {weather_data['humidity']}%
            Wind Speed: {weather_data['wind_speed']} mph
            Pressure: {weather_data['pressure']} hPa
            Visibility: {weather_data['visibility']} km
            Sunrise: {weather_data['sunrise']}
            Sunset: {weather_data['sunset']}
            """

            if "cloud_coverage" in weather_data:
                prompt += f"\nCloud Coverage: {weather_data['cloud_coverage']}%"
            if "rain_1h" in weather_data and weather_data["rain_1h"] > 0:
                prompt += f"\nRainfall (last hour): {weather_data['rain_1h']} mm"
            if "snow_1h" in weather_data and weather_data["snow_1h"] > 0:
                prompt += f"\nSnowfall (last hour): {weather_data['snow_1h']} mm"

            prompt += """

            Please create a friendly and informative email with:
            1. Subject line (start with "SUBJECT: ")
            2. Brief weather summary highlighting key conditions
            3. Recommendations for the day (clothing, activities, etc.)
            4. Any weather alerts or notable conditions

            Format your response as:
            SUBJECT: [subject line]

            [email body]
            """

            email_content = await llm_helper.call_llm(
                prompt=prompt,
                system_prompt="You are writing a weather update email. Be concise, friendly, and highlight important weather information. Format your response as:\nSUBJECT: [subject line]\n\n[email body]"
            )

            ctx.logger.info(f"Generated email for {location}:")
            ctx.logger.info("-" * 50)
            ctx.logger.info(email_content)
            ctx.logger.info("-" * 50)

            # Parse subject and body from LLM response
            if "SUBJECT:" in email_content:
                parts = email_content.split("\n", 2)
                subject = parts[0].replace("SUBJECT:", "").strip()
                body = parts[2].strip() if len(parts) > 2 else parts[1].strip()
            else:
                subject = f"Weather Update for {weather_data['location']}"
                body = email_content

            # Send email to all recipients
            emails_sent = 0
            for recipient in recipients:
                try:
                    # Create message
                    msg = MIMEMultipart('alternative')
                    msg['Subject'] = subject
                    msg['From'] = f"{from_name} <{from_address}>"
                    msg['To'] = recipient
                    msg['Date'] = datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S +0000')

                    # Add plain text body
                    text_part = MIMEText(body, 'plain')
                    msg.attach(text_part)

                    # Send via SMTP
                    ctx.logger.info(f"Sending email to {recipient}...")
                    with smtplib.SMTP(smtp_server, smtp_port, timeout=30) as server:
                        server.starttls()
                        server.login(email_username, email_password)
                        server.send_message(msg)

                    ctx.logger.info(f"✓ Email sent successfully to {recipient}")
                    emails_sent += 1

                except Exception as e:
                    ctx.logger.error(f"Failed to send email to {recipient}: {e}")

            # Store email in log
            email_log = ctx.storage.get("email_log")
            if not email_log:
                email_log = []

            email_log.append({
                "location": weather_data['location'],
                "timestamp": int(time.time()),
                "weather_data": weather_data,
                "subject": subject,
                "body": body,
                "recipients": recipients,
                "emails_sent": emails_sent,
                "sent": True
            })

            # Keep only last 100 entries
            if len(email_log) > 100:
                email_log = email_log[-100:]

            ctx.storage.set("email_log", email_log)

            ctx.logger.info(f"✓ Processed {location}: {emails_sent}/{len(recipients)} emails sent")

        except requests.exceptions.RequestException as e:
            ctx.logger.error(f"Error fetching weather data for {location}: {e}")
        except Exception as e:
            ctx.logger.error(f"Error processing {location}: {e}")
            import traceback
            ctx.logger.error(traceback.format_exc())

    ctx.logger.info("\n" + "="*70)
    ctx.logger.info("Email generation and sending complete!")
    ctx.logger.info("="*70)


@agent.on_interval(period=300.0)
async def verify_configurations(ctx: Context):
    """
    Verify API and email configurations are valid
    """
    ctx.logger.info("Running verify_configurations...")
    
    import os

    ctx.logger.info("Verifying configurations...")

    # Check OpenWeather API
    openweather_api_key = os.getenv("OPENWEATHER_API_KEY")
    if not openweather_api_key:
        ctx.logger.warning("⚠ OPENWEATHER_API_KEY not set")
    else:
        ctx.logger.info("✓ OPENWEATHER_API_KEY: configured")

    # Check email credentials
    email_username = os.getenv("EMAIL_USERNAME")
    email_password = os.getenv("EMAIL_PASSWORD")

    if not email_username:
        ctx.logger.warning("⚠ EMAIL_USERNAME not set")
    else:
        ctx.logger.info(f"✓ EMAIL_USERNAME: {email_username}")

    if not email_password:
        ctx.logger.warning("⚠ EMAIL_PASSWORD not set")
    else:
        ctx.logger.info("✓ EMAIL_PASSWORD: configured")

    # Check recipients
    recipients = ctx.storage.get("recipients")
    if not recipients:
        ctx.logger.warning("⚠ No recipients configured in storage")
    else:
        ctx.logger.info(f"✓ Recipients: {len(recipients)} configured")
        for recipient in recipients:
            ctx.logger.info(f"  - {recipient}")

    # Check locations
    locations = ctx.storage.get("locations")
    ctx.logger.info(f"✓ Locations: {len(locations)} configured")
    for location in locations:
        ctx.logger.info(f"  - {location}")

@agent.on_event("startup")
async def startup(ctx: Context):
    ctx.logger.info(f"Agent {agent.name} starting up...")
    ctx.logger.info(f"Agent address: {agent.address}")

    # Initialize storage only if not already set
    if not ctx.storage.get("locations"):
        ctx.storage.set("locations", ["San Francisco", "New York", "Tokyo"])
    
    if not ctx.storage.get("recipients"):
        ctx.storage.set("recipients", [])
    
    if not ctx.storage.get("email_log"):
        ctx.storage.set("email_log", [])
    
    if not ctx.storage.get("last_run"):
        ctx.storage.set("last_run", 0)
    
    if not ctx.storage.get("email_preferences"):
        ctx.storage.set("email_preferences", {"send_on_conditions": ["Rain", "Snow", "Thunderstorm", "Extreme"], "send_all": True, "units": "imperial"})

    # Startup tasks
    ctx.logger.info("TODO: Initialize weather email agent")
    ctx.logger.info("TODO: Load configured locations")
    ctx.logger.info("TODO: Load recipient list")
    ctx.logger.info("TODO: Initialize LLM client")
    ctx.logger.info("TODO: Verify OpenWeather API credentials")
    ctx.logger.info("TODO: Verify SMTP credentials")
    ctx.logger.info("TODO: Test API connection")


if __name__ == "__main__":
    agent.run()
