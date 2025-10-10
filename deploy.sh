#!/bin/bash
# EC2 deployment script for Zaura Health with PostgreSQL RDS
# This script deploys the application to an EC2 instance with database connectivity

set -e

# Configuration
APP_DIR="/opt/zaura-health"
BACKUP_DIR="/opt/zaura-health-backups"
LOG_FILE="/var/log/zaura-health/deploy.log"

# Environment variables
export PROJECT_NAME="${PROJECT_NAME:-zaura-health}"
export ENVIRONMENT="${ENVIRONMENT:-dev}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}$(date '+%Y-%m-%d %H:%M:%S')${NC} - $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}$(date '+%Y-%m-%d %H:%M:%S')${NC} - ERROR: $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}$(date '+%Y-%m-%d %H:%M:%S')${NC} - WARNING: $1" | tee -a "$LOG_FILE"
}

# Check if running as ec2-user
if [ "$USER" != "ec2-user" ]; then
    error "This script must be run as ec2-user"
fi

# Create directories
sudo mkdir -p "$BACKUP_DIR"
sudo mkdir -p "$(dirname "$LOG_FILE")"
sudo chown ec2-user:ec2-user "$(dirname "$LOG_FILE")"
sudo chown ec2-user:ec2-user "$BACKUP_DIR"

log "Starting deployment process..."

# Navigate to application directory
cd "$APP_DIR" || error "Failed to navigate to $APP_DIR"

# Create backup of current deployment
if [ -f "docker-compose.yml" ]; then
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    log "Creating backup: $BACKUP_NAME"
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
    cp -r . "$BACKUP_DIR/$BACKUP_NAME/" || warn "Backup failed"
fi

# Stop existing containers
log "Stopping existing containers..."
docker-compose down || warn "No existing containers to stop"

# Pull latest code (if this script is run manually)
if [ -d ".git" ]; then
    log "Pulling latest code..."
    git pull origin main || warn "Git pull failed"
fi

# Check if Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    error "Dockerfile not found in $APP_DIR"
fi

# Check if model files exist
if [ ! -d "models" ] || [ ! "$(ls -A models)" ]; then
    warn "Model files not found. Application may not work correctly."
fi

# Get database credentials from AWS Systems Manager Parameter Store
get_database_credentials() {
    log "Retrieving database credentials from AWS Systems Manager..."
    
    # Check if AWS CLI is available and configured
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed or not in PATH"
    fi
    
    # Get database URL from Parameter Store
    DB_URL_PARAMETER="/${PROJECT_NAME}/${ENVIRONMENT}/database/url"
    
    if aws ssm get-parameter --name "$DB_URL_PARAMETER" --with-decryption >/dev/null 2>&1; then
        export DATABASE_URL=$(aws ssm get-parameter --name "$DB_URL_PARAMETER" --with-decryption --query 'Parameter.Value' --output text)
        log "Database credentials retrieved successfully"
    else
        warn "Could not retrieve database credentials from Parameter Store"
        warn "Make sure RDS instance is deployed and parameter exists: $DB_URL_PARAMETER"
        
        # Fallback to environment variables if available
        if [ -z "$DATABASE_URL" ]; then
            error "DATABASE_URL not found in Parameter Store or environment variables"
        fi
    fi
}

# Test database connectivity
test_database_connection() {
    log "Testing database connectivity..."
    
    if [ -z "$DATABASE_URL" ]; then
        error "DATABASE_URL is not set"
    fi
    
    # Extract database host from URL for testing
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
        error "Could not parse database host/port from DATABASE_URL"
    fi
    
    log "Testing connection to PostgreSQL at $DB_HOST:$DB_PORT"
    
    # Test network connectivity
    if timeout 10 bash -c "cat < /dev/null > /dev/tcp/$DB_HOST/$DB_PORT"; then
        log "Database connectivity test passed"
    else
        error "Cannot connect to database at $DB_HOST:$DB_PORT. Check RDS instance and security groups."
    fi
}

# Get database credentials
get_database_credentials

# Test database connection
test_database_connection

# Build new image with RDS support
log "Building Docker image with PostgreSQL support..."
docker build -f Dockerfile.rds -t zaura-health:latest . || error "Docker build failed"

# Remove unused images to save space
log "Cleaning up unused Docker images..."
docker image prune -f || warn "Image cleanup failed"

# Start new containers
log "Starting new containers..."
docker-compose up -d || error "Failed to start containers"

# Wait for application to be ready
log "Waiting for application to start..."
sleep 30

# Health check
log "Performing health check..."
for i in {1..10}; do
    if curl -f http://localhost:5000/api/health >/dev/null 2>&1; then
        log "Health check passed!"
        break
    else
        if [ $i -eq 10 ]; then
            error "Health check failed after 10 attempts"
        fi
        warn "Health check failed, attempt $i/10. Retrying in 10 seconds..."
        sleep 10
    fi
done

# Check Nginx status
log "Checking Nginx status..."
if ! sudo systemctl is-active --quiet nginx; then
    warn "Nginx is not running, attempting to start..."
    sudo systemctl start nginx || error "Failed to start Nginx"
fi

# Display deployment information
log "Deployment completed successfully!"
log "Application URL: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
log "Container status:"
docker-compose ps

# Clean up old backups (keep last 5)
log "Cleaning up old backups..."
cd "$BACKUP_DIR"
ls -t | tail -n +6 | xargs -r rm -rf

log "Deployment script completed!"