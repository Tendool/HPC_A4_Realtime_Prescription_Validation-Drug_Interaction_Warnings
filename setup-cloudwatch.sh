#!/bin/bash
# CloudWatch Agent Setup Script for EC2 t2.micro (Free Tier)
# Optimized for minimal resource usage

set -e

LOG_FILE="/var/log/cloudwatch-setup.log"
CONFIG_DIR="/opt/aws/amazon-cloudwatch-agent/etc"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check if we're on a supported system
check_system() {
    if [[ ! -f /etc/os-release ]]; then
        log "ERROR: Cannot determine OS version"
        exit 1
    fi
    
    . /etc/os-release
    log "INFO: Detected OS: $NAME $VERSION_ID"
    
    # Check if it's Amazon Linux 2 or Ubuntu
    if [[ "$ID" != "amzn" ]] && [[ "$ID" != "ubuntu" ]]; then
        log "WARNING: This script is optimized for Amazon Linux 2 and Ubuntu"
    fi
}

# Function to install CloudWatch agent
install_cloudwatch_agent() {
    log "INFO: Installing CloudWatch Agent..."
    
    # Download and install CloudWatch agent
    if [[ -f /etc/amazon-linux-release ]] || [[ $(grep -c "amzn" /etc/os-release) -gt 0 ]]; then
        # Amazon Linux
        log "INFO: Installing on Amazon Linux..."
        if ! rpm -qa | grep -q amazon-cloudwatch-agent; then
            wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
            sudo rpm -U ./amazon-cloudwatch-agent.rpm
            rm -f ./amazon-cloudwatch-agent.rpm
        else
            log "INFO: CloudWatch Agent already installed"
        fi
    else
        # Ubuntu/Debian
        log "INFO: Installing on Ubuntu/Debian..."
        if ! dpkg -l | grep -q amazon-cloudwatch-agent; then
            wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
            sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
            rm -f ./amazon-cloudwatch-agent.deb
        else
            log "INFO: CloudWatch Agent already installed"
        fi
    fi
    
    log "INFO: CloudWatch Agent installation completed"
}

# Function to create optimized configuration
setup_configuration() {
    log "INFO: Setting up CloudWatch configuration..."
    
    # Create configuration directory
    sudo mkdir -p "$CONFIG_DIR"
    
    # Copy our optimized configuration
    if [[ -f "/app/monitoring/cloudwatch-config.json" ]]; then
        sudo cp /app/monitoring/cloudwatch-config.json "$CONFIG_DIR/amazon-cloudwatch-agent.json"
        log "INFO: Configuration copied from application directory"
    else
        log "ERROR: CloudWatch configuration not found at /app/monitoring/cloudwatch-config.json"
        return 1
    fi
    
    # Create log directories
    sudo mkdir -p /app/logs
    sudo mkdir -p /var/log/docker
    
    # Set proper permissions
    sudo chmod 644 "$CONFIG_DIR/amazon-cloudwatch-agent.json"
    sudo chown root:root "$CONFIG_DIR/amazon-cloudwatch-agent.json"
    
    log "INFO: Configuration setup completed"
}

# Function to start CloudWatch agent
start_cloudwatch_agent() {
    log "INFO: Starting CloudWatch Agent..."
    
    # Configure the agent with our JSON file
    sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
        -a fetch-config \
        -m ec2 \
        -s \
        -c file:"$CONFIG_DIR/amazon-cloudwatch-agent.json"
    
    # Enable service to start on boot
    sudo systemctl enable amazon-cloudwatch-agent
    
    # Check status
    if sudo systemctl is-active --quiet amazon-cloudwatch-agent; then
        log "INFO: CloudWatch Agent is running successfully"
    else
        log "ERROR: CloudWatch Agent failed to start"
        sudo systemctl status amazon-cloudwatch-agent
        return 1
    fi
}

# Function to create custom metrics script
create_custom_metrics() {
    log "INFO: Creating custom application metrics..."
    
    cat << 'EOF' > /tmp/zaura-health-metrics.sh
#!/bin/bash
# Custom metrics for Zaura Health application

# Check if application is responding
APP_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health 2>/dev/null || echo "000")

if [[ "$APP_HEALTH" == "200" ]]; then
    APP_STATUS=1
else
    APP_STATUS=0
fi

# Send custom metric to CloudWatch
aws cloudwatch put-metric-data \
    --namespace "ZauraHealth/Application" \
    --metric-data MetricName=HealthStatus,Value=$APP_STATUS,Unit=None

# Check Docker container status
if docker ps | grep -q zaura-health-app; then
    CONTAINER_STATUS=1
else
    CONTAINER_STATUS=0
fi

aws cloudwatch put-metric-data \
    --namespace "ZauraHealth/Application" \
    --metric-data MetricName=ContainerStatus,Value=$CONTAINER_STATUS,Unit=None

# Get application response time
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" http://localhost:5000/api/health 2>/dev/null || echo "0")
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc 2>/dev/null || echo "0")

aws cloudwatch put-metric-data \
    --namespace "ZauraHealth/Application" \
    --metric-data MetricName=ResponseTime,Value=$RESPONSE_TIME_MS,Unit=Milliseconds
EOF
    
    sudo mv /tmp/zaura-health-metrics.sh /usr/local/bin/zaura-health-metrics.sh
    sudo chmod +x /usr/local/bin/zaura-health-metrics.sh
    
    # Create cron job for custom metrics (every 5 minutes)
    echo "*/5 * * * * /usr/local/bin/zaura-health-metrics.sh > /dev/null 2>&1" | sudo crontab -
    
    log "INFO: Custom metrics setup completed"
}

# Function to verify setup
verify_setup() {
    log "INFO: Verifying CloudWatch setup..."
    
    # Check if agent is running
    if ! sudo systemctl is-active --quiet amazon-cloudwatch-agent; then
        log "ERROR: CloudWatch Agent is not running"
        return 1
    fi
    
    # Check configuration
    if [[ ! -f "$CONFIG_DIR/amazon-cloudwatch-agent.json" ]]; then
        log "ERROR: Configuration file not found"
        return 1
    fi
    
    # Check log directories
    if [[ ! -d /app/logs ]]; then
        log "WARNING: Application log directory not found"
    fi
    
    log "INFO: CloudWatch setup verification completed successfully"
    
    # Show service status
    log "INFO: CloudWatch Agent Status:"
    sudo systemctl status amazon-cloudwatch-agent --no-pager
}

# Function to show setup summary
show_summary() {
    log "INFO: ==================================="
    log "INFO: CloudWatch Setup Summary"
    log "INFO: ==================================="
    log "INFO: Agent Status: $(sudo systemctl is-active amazon-cloudwatch-agent)"
    log "INFO: Configuration: $CONFIG_DIR/amazon-cloudwatch-agent.json"
    log "INFO: Log Groups Created:"
    log "INFO:   - /zaura-health/app (App logs)"
    log "INFO:   - /zaura-health/nginx (Nginx logs)"
    log "INFO:   - /zaura-health/docker (Container logs)"
    log "INFO: Metrics Namespace: ZauraHealth/EC2"
    log "INFO: Custom Metrics: ZauraHealth/Application"
    log "INFO: Retention: 3-7 days (Free tier optimized)"
    log "INFO: Collection Interval: 60 seconds"
    log "INFO: ==================================="
}

# Main execution
main() {
    log "INFO: Starting CloudWatch Agent setup for Zaura Health..."
    log "INFO: Optimized for AWS Free Tier t2.micro instance"
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log "ERROR: This script must be run as root"
        exit 1
    fi
    
    # Check system compatibility
    check_system
    
    # Install CloudWatch agent
    install_cloudwatch_agent
    
    # Setup configuration
    setup_configuration
    
    # Start the agent
    start_cloudwatch_agent
    
    # Create custom metrics
    create_custom_metrics
    
    # Verify everything is working
    verify_setup
    
    # Show summary
    show_summary
    
    log "INFO: CloudWatch Agent setup completed successfully!"
    log "INFO: Logs will be available in CloudWatch within 5-10 minutes"
    log "INFO: Custom application metrics will be updated every 5 minutes"
}

# Run main function
main "$@"