# Terraform environment configuration files

# Development environment
aws_region = "us-east-1"
environment = "dev"
project_name = "zaura-health"
app_name = "zaura-health-app"

# VPC Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b"]
public_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.3.0/24", "10.0.4.0/24"]

# ECS Configuration
container_cpu = 1024
container_memory = 2048
min_capacity = 1
max_capacity = 5
desired_count = 2

# Monitoring
enable_logging = true
log_retention_days = 30

# SSL Certificate (leave empty for HTTP only)
certificate_arn = ""
domain_name = ""