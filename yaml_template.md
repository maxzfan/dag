# EXAMPLE Complete Fetch.ai Agent Configuration Template
# Claude can populate this based on natural language prompts
# Populate as many fields as needed

# ============================================
# AGENT CORE CONFIGURATION
# ============================================
agent:
  name: "my_agent"                          # Agent identifier
  seed: "my_agent_secure_seed_phrase"       # Seed phrase for agent address generation
  port: 8000                                 # Port the agent listens on
  endpoint: "http://localhost:8000/submit"   # Agent endpoint URL
  mailbox: null                              # Optional: Mailbox key for remote communication
  log_level: "INFO"                          # Logging level: DEBUG, INFO, WARNING, ERROR

# ============================================
# PROTOCOLS AND MESSAGE DEFINITIONS
# ============================================
protocols:
  - name: "main_protocol"
    description: "Primary protocol for agent communication"
    messages:
      # Request-Response pattern
      - name: "TaskRequest"
        description: "Request to perform a task"
        fields:
          task_id: "str"
          task_type: "str"
          parameters: "Dict[str, Any]"
          priority: "int"
          timestamp: "int"
      
      - name: "TaskResponse"
        description: "Response after task completion"
        fields:
          task_id: "str"
          success: "bool"
          result: "Any"
          error: "str"
          timestamp: "int"
      
      # LLM Interaction messages
      - name: "LLMRequest"
        description: "Request for LLM processing"
        fields:
          request_id: "str"
          prompt: "str"
          context: "List[Dict[str, str]]"  # conversation history
          system_prompt: "str"
          use_tools: "bool"
          temperature: "float"
      
      - name: "LLMResponse"
        description: "Response from LLM processing"
        fields:
          request_id: "str"
          response: "str"
          tool_calls: "List[Dict[str, Any]]"
          tokens_used: "int"
          finish_reason: "str"
          timestamp: "int"
      
      # Data exchange messages
      - name: "DataQuery"
        description: "Query for specific data"
        fields:
          query_id: "str"
          query_type: "str"
          filters: "Dict[str, Any]"
          limit: "int"
      
      - name: "DataResponse"
        description: "Response containing queried data"
        fields:
          query_id: "str"
          data: "List[Dict[str, Any]]"
          count: "int"
          has_more: "bool"
      
      # Notification messages
      - name: "AlertNotification"
        description: "Alert or notification message"
        fields:
          alert_type: "str"
          severity: "str"
          message: "str"
          data: "Dict[str, Any]"
          timestamp: "int"
      
      # Status messages
      - name: "StatusUpdate"
        description: "Agent status update"
        fields:
          agent_id: "str"
          status: "str"
          metrics: "Dict[str, Any]"
          timestamp: "int"

  # Example additional protocols (can have multiple)
  - name: "trading_protocol"
    description: "Protocol for trading operations"
    messages:
      - name: "TradeOrder"
        fields:
          order_id: "str"
          symbol: "str"
          side: "str"          # buy/sell
          quantity: "float"
          price: "float"
          order_type: "str"    # market/limit
      
      - name: "TradeConfirmation"
        fields:
          order_id: "str"
          status: "str"
          filled_quantity: "float"
          filled_price: "float"
          timestamp: "int"

# ============================================
# INTERVAL TASKS (Periodic Operations) (Optional; use as many or as little)
# ============================================
intervals:
  - period: 10.0
    function_name: "health_check"
    description: "Perform health check every 10 seconds"
    enabled: true
  
  - period: 60.0
    function_name: "sync_data"
    description: "Synchronize data every minute"
    enabled: true
  
  - period: 300.0
    function_name: "update_cache"
    description: "Update cache every 5 minutes"
    enabled: true
  
  - period: 3600.0
    function_name: "daily_report"
    description: "Generate hourly report"
    enabled: false
  
  - period: 30.0
    function_name: "process_llm_queue"
    description: "Process queued LLM requests every 30 seconds"
    enabled: true
    uses_llm: true

# ============================================
# STORAGE CONFIGURATION
# ============================================
storage:
  # Storage keys to initialize
  keys:
    - name: "state"
      default: {}
      description: "Agent state information"
    
    - name: "cache"
      default: {}
      description: "Cached data"
    
    - name: "history"
      default: []
      description: "Historical records"
    
    - name: "config"
      default: {}
      description: "Runtime configuration"
    
    - name: "metrics"
      default: {}
      description: "Performance metrics"
    
    - name: "queue"
      default: []
      description: "Task queue"

# ============================================
# STARTUP TASKS
# ============================================
startup:
  tasks:
    - "Initialize database connection"
    - "Load configuration from environment"
    - "Authenticate with external APIs"
    - "Load historical data"
    - "Register with network"
    - "Start background workers"
  
  # Environment variables needed
  env_vars:
    - "API_KEY"
    - "DATABASE_URL"
    - "NETWORK_ADDRESS"

# ============================================
# EVENT HANDLERS
# ============================================
events:
  - event_type: "startup"
    description: "Actions to perform on agent startup"
    actions:
      - "log_startup"
      - "initialize_storage"
      - "connect_to_services"
  
  - event_type: "shutdown"
    description: "Actions to perform on agent shutdown"
    actions:
      - "save_state"
      - "close_connections"
      - "log_shutdown"

# ============================================
# EXTERNAL INTEGRATIONS
# ============================================
integrations:
  # APIs to connect to
  apis:
    - name: "price_feed_api"
      url: "https://api.example.com/v1"
      auth_type: "api_key"
      required: true
    
    - name: "notification_service"
      url: "https://notifications.example.com"
      auth_type: "bearer"
      required: false
  
  # LLM Integration
  llm:
    provider: "openai"  # openai, anthropic, cohere, huggingface, local
    model: "gpt-4"      # gpt-4, gpt-3.5-turbo, claude-3-opus, etc.
    api_key_env: "OPENAI_API_KEY"
    base_url: null      # Optional: for custom endpoints
    
    # LLM Configuration
    config:
      temperature: 0.7
      max_tokens: 1000
      top_p: 1.0
      frequency_penalty: 0.0
      presence_penalty: 0.0
    
    # Example system prompts
    system_prompts:
      default: "You are a helpful AI agent assistant."
      specialized: "You are an expert in analyzing market data and providing trading insights."
    
    # Function calling / Tools (for LLM tool use)
    tools:
      - name: "get_market_data"
        description: "Fetch current market data for a symbol"
        parameters:
          symbol: "str"
          timeframe: "str"
      
      - name: "execute_trade"
        description: "Execute a trading order"
        parameters:
          symbol: "str"
          side: "str"
          quantity: "float"
      
      - name: "search_knowledge_base"
        description: "Search internal knowledge base"
        parameters:
          query: "str"
          limit: "int"
    
    # Context management
    context:
      max_history: 10          # Number of messages to keep in context
      max_context_tokens: 8000 # Maximum tokens for context
      summarize_old: true      # Summarize old messages when context is full
    
    # Response handling
    response_handling:
      stream: false            # Stream responses
      retry_on_error: true
      max_retries: 3
      cache_responses: true
      cache_ttl: 3600         # Cache time-to-live in seconds
  
  # Databases
  databases:
    - type: "postgresql"
      name: "main_db"
      required: false
    
    - type: "redis"
      name: "cache_db"
      required: false
    
    - type: "vector_db"       # For LLM embeddings/RAG
      name: "vector_store"
      provider: "pinecone"    # pinecone, weaviate, chroma, qdrant
      required: false

# ============================================
# AGENT BEHAVIOR RULES
# ============================================
behavior:
  # Conditions and triggers
  rules:
    - name: "price_threshold_alert"
      condition: "price > threshold"
      action: "send_alert"
      parameters:
        threshold: 100
    
    - name: "queue_size_limit"
      condition: "queue_size > max_size"
      action: "process_urgent_only"
      parameters:
        max_size: 1000
  
  # Rate limiting
  rate_limits:
    - operation: "api_calls"
      limit: 100
      period: 60  # per minute
    
    - operation: "message_sends"
      limit: 1000
      period: 3600  # per hour

# ============================================
# AGENT CAPABILITIES & METADATA
# ============================================
metadata:
  description: "Agent description goes here"
  version: "1.0.0"
  author: "Your Name"
  tags:
    - "trading"
    - "oracle"
    - "automation"
  
  capabilities:
    - "data_fetching"
    - "price_monitoring"
    - "automated_trading"
    - "alert_notifications"
  
  dependencies:
    - "requests"
    - "aiohttp"
    - "pandas"

# ============================================
# AGENT NETWORK CONFIGURATION
# ============================================
network:
  # Other agents this agent communicates with
  peers:
    - name: "price_oracle"
      address: "agent1q..."
      protocols:
        - "price_protocol"
    
    - name: "trading_executor"
      address: "agent1q..."
      protocols:
        - "trading_protocol"
  
  # Services this agent provides
  services:
    - name: "data_provider"
      description: "Provides market data"
      protocol: "main_protocol"
    
    - name: "alert_service"
      description: "Sends alerts and notifications"
      protocol: "main_protocol"

# ============================================
# DEPLOYMENT CONFIGURATION
# ============================================
deployment:
  # Deployment mode
  mode: "production"  # local, testnet, mainnet, production
  
  # Almanac Contract Registration (makes agent discoverable)
  almanac:
    register: true
    network: "testnet"  # testnet, mainnet
    service_endpoints:
      - protocol: "main_protocol"
        endpoint: "http://your-server.com:8000/submit"
    
    # Agent service metadata for Almanac
    service_metadata:
      name: "My Agent Service"
      description: "Description of what this agent does"
      category: "data_oracle"  # trading, oracle, defi, nft, gaming, etc.
      tags:
        - "market_data"
        - "price_feed"
      version: "1.0.0"
  
  # Mailbox Configuration (for agents behind firewalls/NAT)
  mailbox:
    enabled: true
    key: "your-mailbox-key"  # Get from agentverse.ai
    
  # Agent hosting options
  hosting:
    type: "self_hosted"  # self_hosted, agentverse, cloud
    
    # For self-hosted deployments
    self_hosted:
      server_ip: "your-server-ip"
      domain: "agent.yourdomain.com"  # Optional: custom domain
      ssl_enabled: true
      reverse_proxy: "nginx"  # nginx, apache, caddy
    
    # For Agentverse deployment
    agentverse:
      api_key_env: "AGENTVERSE_API_KEY"
      auto_deploy: true
      environment: "production"  # development, staging, production
    
    # For cloud deployment
    cloud:
      provider: "aws"  # aws, gcp, azure, digitalocean
      region: "us-east-1"
      instance_type: "t3.small"
      auto_scale: false
  
  # Service Discovery
  discovery:
    # Register with DeltaV (Fetch.ai's consumer-facing interface)
    deltav:
      enabled: true
      function_groups:
        - name: "Market Data Functions"
          description: "Get real-time market data"
          functions:
            - name: "get_price"
              description: "Get current price for a symbol"
              parameters:
                - name: "symbol"
                  type: "string"
                  required: true
                  description: "Trading symbol (e.g., BTC, ETH)"
            
            - name: "get_volume"
              description: "Get trading volume"
              parameters:
                - name: "symbol"
                  type: "string"
                  required: true
                - name: "timeframe"
                  type: "string"
                  required: false
                  default: "24h"
      
      # Pricing for DeltaV users (optional)
      pricing:
        model: "free"  # free, pay_per_use, subscription
        currency: "FET"  # FET, USD
        rates:
          get_price: 0.01  # Cost per function call
  
  # Agent Communication Setup
  communication:
    # Public endpoint for other agents to reach this agent
    public_endpoint: "http://your-server.com:8000/submit"
    
    # Use Fetch.ai infrastructure
    use_fetch_infrastructure: true
    
    # Backup endpoints
    backup_endpoints:
      - "http://backup-server.com:8000/submit"
  
  # Security & Authentication
  security:
    # Restrict which agents can communicate
    whitelist_enabled: false
    allowed_agents:
      - "agent1q..."
      - "agent1q..."
    
    # API key for external requests
    require_api_key: false
    api_key_env: "AGENT_API_KEY"
    
    # Rate limiting
    rate_limiting:
      enabled: true
      requests_per_minute: 100
      requests_per_day: 10000
  
  # Monitoring & Health Checks
  monitoring:
    health_check_endpoint: "/health"
    metrics_endpoint: "/metrics"
    
    # External monitoring services
    external_monitoring:
      - service: "uptime_robot"
        enabled: false
      - service: "datadog"
        enabled: false
        api_key_env: "DATADOG_API_KEY"
  
  # Persistence & Backup
  persistence:
    # Where to store agent state
    storage_backend: "local"  # local, s3, gcs, azure_blob
    backup_enabled: true
    backup_frequency: "daily"  # hourly, daily, weekly
    backup_retention: 30  # days
  
  # Environment Variables Required for Deployment
  required_env_vars:
    - "FETCH_NETWORK"
    - "AGENT_SEED"
    - "API_KEY"
  
  # Deployment checklist
  deployment_steps:
    - step: 1
      action: "Set environment variables"
      commands:
        - "export FETCH_NETWORK=testnet"
        - "export AGENT_SEED=your_seed_phrase"
    
    - step: 2
      action: "Register on Almanac"
      commands:
        - "python agent.py --register"
    
    - step: 3
      action: "Start agent as service"
      commands:
        - "python agent.py --daemon"
        # OR
        - "systemctl start fetch-agent"
    
    - step: 4
      action: "Verify agent is discoverable"
      commands:
        - "python verify_agent.py --address agent1q..."
    
    - step: 5
      action: "Test agent communication"
      commands:
        - "python test_agent.py --send-test-message"

# ============================================
# ERROR HANDLING & RECOVERY
# ============================================
error_handling:
  retry_policy:
    max_retries: 3
    backoff_multiplier: 2
    max_backoff: 60
  
  fallback_actions:
    - error_type: "connection_error"
      action: "use_cached_data"
    
    - error_type: "rate_limit_exceeded"
      action: "queue_for_later"
    
    - error_type: "invalid_data"
      action: "log_and_skip"

# ============================================
# MONITORING & ALERTS
# ============================================
monitoring:
  metrics:
    - "messages_processed"
    - "errors_count"
    - "response_time"
    - "queue_size"
    - "cache_hit_rate"
  
  alerts:
    - name: "high_error_rate"
      condition: "error_rate > 0.1"
      notification: "email"
    
    - name: "agent_down"
      condition: "no_heartbeat > 300"
      notification: "sms"

