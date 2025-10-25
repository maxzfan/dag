#!/usr/bin/env python3
"""
Fetch.ai Agent Deployment Script
Deploys agents to Fetch.ai testnet or mainnet with proper configuration
"""

import os
import sys
import json
import subprocess
import argparse
from pathlib import Path
from typing import Dict, Any, Optional
import yaml

class FetchAgentDeployer:
    def __init__(self, network: str = "testnet"):
        self.network = network.lower()
        self.agent_dir = None
        self.agent_config = None
        
        # Network configurations
        self.networks = {
            "testnet": {
                "name": "testnet",
                "rpc_url": "https://rpc-fetchhub.fetch-ai.com:443",
                "chain_id": "fetchhub-testnet-4",
                "explorer": "https://testnet-explorer.fetch.ai",
                "almanac_url": "https://almanac-fetchhub.fetch-ai.com",
                "description": "Fetch.ai Testnet"
            },
            "mainnet": {
                "name": "mainnet", 
                "rpc_url": "https://rpc-fetchhub.fetch-ai.com:443",
                "chain_id": "fetchhub-4",
                "explorer": "https://explore.fetch.ai",
                "almanac_url": "https://almanac-fetchhub.fetch-ai.com",
                "description": "Fetch.ai Mainnet"
            }
        }
        
        if self.network not in self.networks:
            raise ValueError(f"Unsupported network: {network}. Supported networks: {list(self.networks.keys())}")
    
    def load_agent_config(self, agent_dir: str) -> Dict[str, Any]:
        """Load agent configuration from YAML or generated files"""
        agent_path = Path(agent_dir)
        
        # Look for YAML config first
        yaml_files = list(agent_path.glob("*.yaml")) + list(agent_path.glob("*.yml"))
        if yaml_files:
            with open(yaml_files[0], 'r') as f:
                self.agent_config = yaml.safe_load(f)
        else:
            # Try to load from generated Python file
            py_files = list(agent_path.glob("*_agent.py"))
            if not py_files:
                # Try any Python file
                py_files = list(agent_path.glob("*.py"))
            
            if py_files:
                self.agent_config = self._extract_config_from_py(py_files[0])
            else:
                raise FileNotFoundError(f"No agent configuration found in {agent_dir}")
        
        self.agent_dir = agent_dir
        return self.agent_config
    
    def _extract_config_from_py(self, py_file: Path) -> Dict[str, Any]:
        """Extract basic config from generated Python file"""
        with open(py_file, 'r') as f:
            content = f.read()
        
        # Extract agent name
        import re
        name_match = re.search(r'name="([^"]+)"', content)
        agent_name = name_match.group(1) if name_match else "unknown_agent"
        
        # Extract port
        port_match = re.search(r'port=(\d+)', content)
        port = int(port_match.group(1)) if port_match else 8000
        
        return {
            "agent": {
                "name": agent_name,
                "port": port
            },
            "deployment": {
                "mode": "production",
                "almanac": {
                    "register": True,
                    "network": self.network
                }
            }
        }
    
    def create_deployment_env(self) -> str:
        """Create deployment environment file"""
        env_content = []
        
        # Network configuration
        network_config = self.networks[self.network]
        env_content.append(f"# Fetch.ai {network_config['description']} Configuration")
        env_content.append(f"FETCH_NETWORK={self.network}")
        env_content.append(f"FETCH_RPC_URL={network_config['rpc_url']}")
        env_content.append(f"FETCH_CHAIN_ID={network_config['chain_id']}")
        env_content.append(f"FETCH_ALMANAC_URL={network_config['almanac_url']}")
        env_content.append("")
        
        # Agent configuration
        if self.agent_config:
            agent_name = self.agent_config.get('agent', {}).get('name', 'unknown_agent')
            env_content.append(f"# Agent Configuration")
            env_content.append(f"AGENT_NAME={agent_name}")
            env_content.append(f"AGENT_SEED={agent_name}_seed_{self.network}")
            env_content.append("")
            
            # LLM configuration
            if self.agent_config.get('integrations', {}).get('llm'):
                llm_config = self.agent_config['integrations']['llm']
                api_key_env = llm_config.get('api_key_env', 'OPENAI_API_KEY')
                env_content.append(f"# LLM Configuration")
                env_content.append(f"{api_key_env}=your_api_key_here")
                
                if llm_config.get('provider') == 'openrouter':
                    env_content.append(f"OPENROUTER_BASE_URL={llm_config.get('base_url', 'https://openrouter.ai/api/v1')}")
                env_content.append("")
        
        # Deployment configuration
        env_content.append("# Deployment Configuration")
        env_content.append(f"DEPLOYMENT_MODE=production")
        env_content.append(f"ALMANAC_REGISTER=true")
        env_content.append(f"ALMANAC_NETWORK={self.network}")
        env_content.append("")
        
        # Optional: Wallet configuration
        env_content.append("# Optional: Wallet Configuration (for advanced deployments)")
        env_content.append("# WALLET_MNEMONIC=your_wallet_mnemonic_here")
        env_content.append("# WALLET_PASSWORD=your_wallet_password")
        
        env_file = os.path.join(self.agent_dir, f".env.{self.network}")
        with open(env_file, 'w') as f:
            f.write('\n'.join(env_content))
        
        return env_file
    
    def create_dockerfile(self) -> str:
        """Create Dockerfile for containerized deployment"""
        dockerfile_content = f"""# Fetch.ai Agent Dockerfile for {self.network.title()}
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent files
COPY . .

# Create non-root user
RUN useradd -m -u 1000 agent && chown -R agent:agent /app
USER agent

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8000/health || exit 1

# Run agent
CMD ["python", "weather_aggregator.py"]
"""
        
        dockerfile_path = os.path.join(self.agent_dir, "Dockerfile")
        with open(dockerfile_path, 'w') as f:
            f.write(dockerfile_content)
        
        return dockerfile_path
    
    def create_docker_compose(self) -> str:
        """Create docker-compose.yml for easy deployment"""
        agent_name = self.agent_config.get('agent', {}).get('name', 'fetch_agent') if self.agent_config else 'fetch_agent'
        port = self.agent_config.get('agent', {}).get('port', 8000) if self.agent_config else 8000
        
        compose_content = f"""version: '3.8'

services:
  {agent_name}:
    build: .
    container_name: {agent_name}_{self.network}
    ports:
      - "{port}:8000"
    environment:
      - FETCH_NETWORK={self.network}
      - FETCH_RPC_URL={self.networks[self.network]['rpc_url']}
      - FETCH_CHAIN_ID={self.networks[self.network]['chain_id']}
      - FETCH_ALMANAC_URL={self.networks[self.network]['almanac_url']}
    env_file:
      - .env.{self.network}
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
    networks:
      - fetch_network

networks:
  fetch_network:
    driver: bridge
"""
        
        compose_path = os.path.join(self.agent_dir, "docker-compose.yml")
        with open(compose_path, 'w') as f:
            f.write(compose_content)
        
        return compose_path
    
    def create_deployment_script(self) -> str:
        """Create deployment script"""
        network_config = self.networks[self.network]
        
        script_content = f"""#!/bin/bash
# Fetch.ai Agent Deployment Script for {network_config['description']}

set -e

echo "[DEPLOY] Deploying Fetch.ai Agent to {network_config['description']}"
echo "Network: {self.network}"
echo "RPC URL: {network_config['rpc_url']}"
echo "Chain ID: {network_config['chain_id']}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "[ERROR] docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

# Check environment file
if [ ! -f ".env.{self.network}" ]; then
    echo "[ERROR] Environment file .env.{self.network} not found."
    echo "Please run: python deploy.py --network {self.network} --setup"
    exit 1
fi

# Build and start the agent
echo "[BUILD] Building Docker image..."
docker-compose build

echo "[DEPLOY] Starting agent..."
docker-compose up -d

echo "[OK] Agent deployed successfully!"
echo ""
echo "[STATUS] Agent Status:"
docker-compose ps

echo ""
echo "[INFO] Useful commands:"
echo "  View logs: docker-compose logs -f"
echo "  Stop agent: docker-compose down"
echo "  Restart agent: docker-compose restart"
echo "  Update agent: docker-compose pull && docker-compose up -d"

echo ""
echo "[NETWORK] Agent will be available at:"
echo "  Local: http://localhost:8000"
echo "  Almanac: {network_config['almanac_url']}"
echo "  Explorer: {network_config['explorer']}"
"""
        
        script_path = os.path.join(self.agent_dir, f"deploy_{self.network}.sh")
        with open(script_path, 'w') as f:
            f.write(script_content)
        
        # Make it executable
        os.chmod(script_path, 0o755)
        
        return script_path
    
    def create_kubernetes_manifests(self) -> str:
        """Create Kubernetes deployment manifests"""
        agent_name = self.agent_config.get('agent', {}).get('name', 'fetch_agent') if self.agent_config else 'fetch_agent'
        port = self.agent_config.get('agent', {}).get('port', 8000) if self.agent_config else 8000
        
        k8s_content = f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: {agent_name}-{self.network}
  labels:
    app: {agent_name}
    network: {self.network}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {agent_name}
      network: {self.network}
  template:
    metadata:
      labels:
        app: {agent_name}
        network: {self.network}
    spec:
      containers:
      - name: {agent_name}
        image: {agent_name}:latest
        ports:
        - containerPort: 8000
        env:
        - name: FETCH_NETWORK
          value: "{self.network}"
        - name: FETCH_RPC_URL
          value: "{self.networks[self.network]['rpc_url']}"
        - name: FETCH_CHAIN_ID
          value: "{self.networks[self.network]['chain_id']}"
        - name: FETCH_ALMANAC_URL
          value: "{self.networks[self.network]['almanac_url']}"
        envFrom:
        - secretRef:
            name: {agent_name}-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: {agent_name}-service
  labels:
    app: {agent_name}
    network: {self.network}
spec:
  selector:
    app: {agent_name}
    network: {self.network}
  ports:
  - port: 80
    targetPort: 8000
    protocol: TCP
  type: ClusterIP
---
apiVersion: v1
kind: Secret
metadata:
  name: {agent_name}-secrets
type: Opaque
stringData:
  OPENROUTER_API_KEY: "your_api_key_here"
  # Add other secrets as needed
"""
        
        k8s_path = os.path.join(self.agent_dir, f"k8s-{self.network}.yaml")
        with open(k8s_path, 'w') as f:
            f.write(k8s_content)
        
        return k8s_path
    
    def create_terraform_config(self) -> str:
        """Create Terraform configuration for cloud deployment"""
        agent_name = self.agent_config.get('agent', {}).get('name', 'fetch_agent') if self.agent_config else 'fetch_agent'
        
        terraform_content = f"""# Terraform configuration for Fetch.ai Agent on {self.network.title()}
terraform {{
  required_providers {{
    aws = {{
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }}
  }}
}}

provider "aws" {{
  region = "us-east-1"
}}

# VPC and networking
resource "aws_vpc" "fetch_vpc" {{
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {{
    Name = "fetch-agent-vpc"
    Network = "{self.network}"
  }}
}}

resource "aws_subnet" "fetch_subnet" {{
  vpc_id            = aws_vpc.fetch_vpc.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "us-east-1a"

  tags = {{
    Name = "fetch-agent-subnet"
  }}
}}

resource "aws_internet_gateway" "fetch_gw" {{
  vpc_id = aws_vpc.fetch_vpc.id

  tags = {{
    Name = "fetch-agent-gateway"
  }}
}}

resource "aws_route_table" "fetch_rt" {{
  vpc_id = aws_vpc.fetch_vpc.id

  route {{
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.fetch_gw.id
  }}

  tags = {{
    Name = "fetch-agent-route-table"
  }}
}}

resource "aws_route_table_association" "fetch_rta" {{
  subnet_id      = aws_subnet.fetch_subnet.id
  route_table_id = aws_route_table.fetch_rt.id
}}

# Security group
resource "aws_security_group" "fetch_sg" {{
  name_prefix = "fetch-agent-sg"
  vpc_id      = aws_vpc.fetch_vpc.id

  ingress {{
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }}

  ingress {{
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }}

  egress {{
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }}

  tags = {{
    Name = "fetch-agent-security-group"
  }}
}}

# EC2 instance
resource "aws_instance" "fetch_agent" {{
  ami                    = "ami-0c02fb55956c7d316"  # Ubuntu 20.04 LTS
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.fetch_subnet.id
  vpc_security_group_ids = [aws_security_group.fetch_sg.id]
  key_name               = "your-key-pair"  # Replace with your key pair

  user_data = <<-EOF
    #!/bin/bash
    apt-get update
    apt-get install -y docker.io docker-compose git
    systemctl start docker
    systemctl enable docker
    usermod -aG docker ubuntu
    
    # Clone and deploy agent
    git clone <your-repo-url> /home/ubuntu/agent
    cd /home/ubuntu/agent
    chmod +x deploy_{self.network}.sh
    ./deploy_{self.network}.sh
  EOF

  tags = {{
    Name = "{agent_name}-{self.network}"
    Network = "{self.network}"
  }}
}}

# Output
output "agent_public_ip" {{
  value = aws_instance.fetch_agent.public_ip
}}

output "agent_url" {{
  value = "http://${{aws_instance.fetch_agent.public_ip}}:8000"
}}
"""
        
        terraform_path = os.path.join(self.agent_dir, f"terraform-{self.network}.tf")
        with open(terraform_path, 'w') as f:
            f.write(terraform_content)
        
        return terraform_path
    
    def setup_deployment(self) -> Dict[str, str]:
        """Setup complete deployment configuration"""
        if not self.agent_config:
            raise ValueError("Agent configuration not loaded. Call load_agent_config() first.")
        
        print(f"[SETUP] Setting up deployment for {self.network.title()}...")
        
        files_created = {}
        
        # Create environment file
        env_file = self.create_deployment_env()
        files_created['env'] = env_file
        print(f"[OK] Created environment file: {env_file}")
        
        # Create Dockerfile
        dockerfile = self.create_dockerfile()
        files_created['dockerfile'] = dockerfile
        print(f"[OK] Created Dockerfile: {dockerfile}")
        
        # Create docker-compose
        compose_file = self.create_docker_compose()
        files_created['compose'] = compose_file
        print(f"[OK] Created docker-compose.yml: {compose_file}")
        
        # Create deployment script
        deploy_script = self.create_deployment_script()
        files_created['script'] = deploy_script
        print(f"[OK] Created deployment script: {deploy_script}")
        
        # Create Kubernetes manifests
        k8s_file = self.create_kubernetes_manifests()
        files_created['k8s'] = k8s_file
        print(f"[OK] Created Kubernetes manifests: {k8s_file}")
        
        # Create Terraform configuration
        terraform_file = self.create_terraform_config()
        files_created['terraform'] = terraform_file
        print(f"[OK] Created Terraform configuration: {terraform_file}")
        
        return files_created
    
    def deploy_local(self) -> bool:
        """Deploy agent locally using docker-compose"""
        try:
            print(f"[DEPLOY] Deploying agent locally to {self.network.title()}...")
            
            # Change to agent directory
            os.chdir(self.agent_dir)
            
            # Run deployment script
            deploy_script = f"deploy_{self.network}.sh"
            if os.path.exists(deploy_script):
                result = subprocess.run([f"./{deploy_script}"], 
                                      capture_output=True, text=True)
                if result.returncode == 0:
                    print("[OK] Agent deployed successfully!")
                    print(result.stdout)
                    return True
                else:
                    print("[ERROR] Deployment failed!")
                    print(result.stderr)
                    return False
            else:
                print(f"[ERROR] Deployment script {deploy_script} not found!")
                return False
                
        except Exception as e:
            print(f"[ERROR] Deployment error: {e}")
            return False
    
    def print_deployment_info(self):
        """Print deployment information and next steps"""
        network_config = self.networks[self.network]
        agent_name = self.agent_config.get('agent', {}).get('name', 'fetch_agent') if self.agent_config else 'fetch_agent'
        
        print("\n" + "="*80)
        print(f"[TARGET] DEPLOYMENT SETUP COMPLETE FOR {self.network.upper()}")
        print("="*80)
        print(f"Network: {network_config['description']}")
        print(f"Agent: {agent_name}")
        print(f"RPC URL: {network_config['rpc_url']}")
        print(f"Chain ID: {network_config['chain_id']}")
        print(f"Almanac: {network_config['almanac_url']}")
        print(f"Explorer: {network_config['explorer']}")
        print("\n[FILES] Files Created:")
        print(f"  - .env.{self.network} (Environment configuration)")
        print(f"  - Dockerfile (Container configuration)")
        print(f"  - docker-compose.yml (Local deployment)")
        print(f"  - deploy_{self.network}.sh (Deployment script)")
        print(f"  - k8s-{self.network}.yaml (Kubernetes manifests)")
        print(f"  - terraform-{self.network}.tf (Cloud infrastructure)")
        
        print("\n[DEPLOY] Next Steps:")
        print("1. Edit .env.{self.network} with your API keys")
        print("2. Choose deployment method:")
        print("   Local: ./deploy_{self.network}.sh")
        print("   Kubernetes: kubectl apply -f k8s-{self.network}.yaml")
        print("   AWS: terraform init && terraform apply")
        print("\n[DOCS] For more info, see DEPLOYMENT.md")
        print("="*80)


def main():
    parser = argparse.ArgumentParser(description="Deploy Fetch.ai agents to testnet or mainnet")
    parser.add_argument("agent_dir", help="Directory containing agent files")
    parser.add_argument("--network", choices=["testnet", "mainnet"], default="testnet",
                       help="Target network (default: testnet)")
    parser.add_argument("--setup", action="store_true", 
                       help="Setup deployment files only")
    parser.add_argument("--deploy", action="store_true",
                       help="Deploy agent after setup")
    
    args = parser.parse_args()
    
    try:
        deployer = FetchAgentDeployer(args.network)
        
        # Load agent configuration
        deployer.load_agent_config(args.agent_dir)
        
        # Setup deployment files
        deployer.setup_deployment()
        
        # Print deployment info
        deployer.print_deployment_info()
        
        # Deploy if requested
        if args.deploy:
            success = deployer.deploy_local()
            if success:
                print("\n[SUCCESS] Agent is now running!")
            else:
                print("\n[FAILED] Deployment failed. Check the logs above.")
                sys.exit(1)
        
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
