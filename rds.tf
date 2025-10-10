# RDS Subnet Group for database
resource "aws_db_subnet_group" "zaura_health_db" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = [aws_subnet.public_subnet_1.id, aws_subnet.public_subnet_2.id]

  tags = {
    Name        = "${var.project_name}-db-subnet-group"
    Environment = var.environment
    Project     = var.project_name
  }
}

# RDS Security Group
resource "aws_security_group" "rds_sg" {
  name_prefix = "${var.project_name}-rds-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for RDS PostgreSQL database"

  # Allow PostgreSQL access from EC2 instances
  ingress {
    description     = "PostgreSQL from EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2_sg.id]
  }

  # Allow PostgreSQL access from specific CIDR (for development/maintenance)
  ingress {
    description = "PostgreSQL from allowed IPs"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.db_allowed_cidr_blocks
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-rds-sg"
    Environment = var.environment
    Project     = var.project_name
  }

  lifecycle {
    create_before_destroy = true
  }
}

# RDS Parameter Group for optimized performance
resource "aws_db_parameter_group" "zaura_health_postgres" {
  family = "postgres15"
  name   = "${var.project_name}-postgres15-params"

  # Optimize for small instance and free tier
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log queries taking > 1 second
  }

  parameter {
    name  = "max_connections"
    value = "100" # Reduced for t3.micro
  }

  tags = {
    Name        = "${var.project_name}-postgres-params"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Generate random password for database
resource "random_password" "db_password" {
  length  = 16
  special = true
  upper   = true
  lower   = true
  numeric = true
}

# Store database password in AWS Systems Manager Parameter Store
resource "aws_ssm_parameter" "db_password" {
  name        = "/${var.project_name}/${var.environment}/database/password"
  description = "Database password for Zaura Health PostgreSQL"
  type        = "SecureString"
  value       = random_password.db_password.result

  tags = {
    Name        = "${var.project_name}-db-password"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Store database connection string
resource "aws_ssm_parameter" "db_url" {
  name        = "/${var.project_name}/${var.environment}/database/url"
  description = "Database connection URL for Zaura Health"
  type        = "SecureString"
  value       = "postgresql://${var.db_username}:${random_password.db_password.result}@${aws_db_instance.zaura_health_db.endpoint}:${aws_db_instance.zaura_health_db.port}/${var.db_name}"

  tags = {
    Name        = "${var.project_name}-db-url"
    Environment = var.environment
    Project     = var.project_name
  }

  depends_on = [aws_db_instance.zaura_health_db]
}

# RDS PostgreSQL Instance (Free Tier Eligible)
resource "aws_db_instance" "zaura_health_db" {
  # Instance Configuration (Free Tier)
  identifier     = "${var.project_name}-postgres-db"
  engine         = "postgres"
  engine_version = "15.4" # Latest supported version for free tier
  instance_class = "db.t3.micro" # Free tier eligible

  # Database Configuration
  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password.result
  port     = 5432

  # Storage Configuration (Free Tier: 20GB SSD)
  allocated_storage     = 20 # Maximum for free tier
  max_allocated_storage = 20 # Prevent auto-scaling beyond free tier
  storage_type          = "gp2" # General Purpose SSD
  storage_encrypted     = true

  # Network Configuration
  db_subnet_group_name   = aws_db_subnet_group.zaura_health_db.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  publicly_accessible    = false # Keep private for security

  # Performance Configuration
  parameter_group_name = aws_db_parameter_group.zaura_health_postgres.name
  
  # Backup Configuration (Free Tier: 7 days retention)
  backup_retention_period = 7 # Maximum for free tier
  backup_window          = "03:00-04:00" # UTC
  maintenance_window     = "sun:04:00-sun:05:00" # UTC
  
  # Monitoring (Free Tier Compatible)
  monitoring_interval = 0 # Disable enhanced monitoring to stay in free tier
  enabled_cloudwatch_logs_exports = ["postgresql"] # Basic logs only

  # Security and Maintenance
  auto_minor_version_upgrade = true
  deletion_protection       = false # Allow deletion for development
  skip_final_snapshot      = true  # For development environment
  
  # Performance Insights (Free Tier: 7 days retention)
  performance_insights_enabled = true
  performance_insights_retention_period = 7 # Free tier limit

  tags = {
    Name        = "${var.project_name}-postgres-db"
    Environment = var.environment
    Project     = var.project_name
    Tier        = "free-tier"
    Engine      = "postgres"
    Version     = "15.4"
  }

  # Ensure proper cleanup order
  depends_on = [
    aws_db_subnet_group.zaura_health_db,
    aws_security_group.rds_sg,
    aws_db_parameter_group.zaura_health_postgres
  ]
}

# Create additional subnets for RDS (requires at least 2 AZs)
resource "aws_subnet" "public_subnet_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.subnet_cidr_2
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.project_name}-public-subnet-2"
    Environment = var.environment
    Project     = var.project_name
    Type        = "public"
  }
}

# Route table association for second subnet
resource "aws_route_table_association" "public_subnet_2" {
  subnet_id      = aws_subnet.public_subnet_2.id
  route_table_id = aws_route_table.public.id
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}