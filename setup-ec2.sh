#!/bin/bash
# EC2 setup script for initial server configuration
# Run this script once after the EC2 instance is created

set -e

# Configuration
APP_DIR="/opt/zaura-health"
LOG_FILE="/var/log/zaura-health/setup.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}$(date '+%Y-%m-%d %H:%M:%S')${NC} - $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}$(date '+%Y-%m-%d %H:%M:%S')${NC} - ERROR: $1" | tee -a "$LOG_FILE"
    exit 1
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root (use sudo)"
fi

log "Starting EC2 setup for Zaura Health..."

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"
chown ec2-user:ec2-user "$(dirname "$LOG_FILE")"

# Update system
log "Updating system packages..."
yum update -y

# Install Docker
log "Installing Docker..."
amazon-linux-extras install docker -y
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
log "Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install PostgreSQL client for database testing
log "Installing PostgreSQL client..."
amazon-linux-extras install postgresql13 -y

# Install AWS CLI v2 (if not already installed)
log "Installing AWS CLI v2..."
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    yum install -y unzip
    unzip awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip
else
    log "AWS CLI already installed"
fi
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# Install additional tools
log "Installing additional tools..."
yum install -y git htop curl wget unzip

# Install AWS CLI v2
log "Installing AWS CLI v2..."
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

# Install Nginx
log "Installing and configuring Nginx..."
amazon-linux-extras install nginx1 -y

# Create Nginx configuration
cat > /etc/nginx/conf.d/zaura-health.conf << 'EOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 10M;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (for load balancer)
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Static files (if any)
    location /static/ {
        proxy_pass http://localhost:5000/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

systemctl enable nginx
systemctl start nginx

# Create application directory
log "Setting up application directory..."
mkdir -p "$APP_DIR"
chown ec2-user:ec2-user "$APP_DIR"

# Create systemd service
log "Creating systemd service..."
cat > /etc/systemd/system/zaura-health.service << 'EOF'
[Unit]
Description=Zaura Health Drug Interaction API
After=docker.service network.target
Requires=docker.service

[Service]
Type=forking
Restart=always
RestartSec=10
User=ec2-user
Group=ec2-user
WorkingDirectory=/opt/zaura-health
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
ExecReload=/usr/local/bin/docker-compose restart
TimeoutStartSec=300
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

systemctl enable zaura-health

# Configure log rotation
log "Setting up log rotation..."
cat > /etc/logrotate.d/zaura-health << 'EOF'
/var/log/zaura-health/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 ec2-user ec2-user
    postrotate
        systemctl reload nginx > /dev/null 2>&1 || true
    endscript
}
EOF

# Create swap file (helps with limited memory)
log "Creating swap file..."
if [ ! -f /swapfile ]; then
    dd if=/dev/zero of=/swapfile bs=1M count=1024  # 1GB swap
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Configure firewall (optional)
log "Configuring basic firewall rules..."
# Note: AWS Security Groups are primary firewall, this is backup
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --reload
fi

# Set up CloudWatch agent config (free tier compatible)
log "Setting up CloudWatch agent configuration..."
mkdir -p /opt/aws/amazon-cloudwatch-agent/etc
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOF'
{
    "metrics": {
        "namespace": "Zaura/EC2",
        "metrics_collected": {
            "mem": {
                "measurement": ["mem_used_percent"]
            },
            "disk": {
                "measurement": ["used_percent"],
                "metrics_collection_interval": 300,
                "resources": ["*"]
            }
        }
    },
    "logs": {
        "logs_collected": {
            "files": {
                "collect_list": [
                    {
                        "file_path": "/var/log/zaura-health/deploy.log",
                        "log_group_name": "/aws/ec2/zaura-health",
                        "log_stream_name": "{instance_id}/deploy"
                    },
                    {
                        "file_path": "/var/log/nginx/access.log",
                        "log_group_name": "/aws/ec2/zaura-health",
                        "log_stream_name": "{instance_id}/nginx-access"
                    }
                ]
            }
        }
    }
}
EOF

# Create deployment helper scripts
log "Creating helper scripts..."
cat > /home/ec2-user/status.sh << 'EOF'
#!/bin/bash
echo "=== Zaura Health Application Status ==="
echo ""
echo "Docker Containers:"
cd /opt/zaura-health && docker-compose ps
echo ""
echo "Nginx Status:"
systemctl status nginx --no-pager -l
echo ""
echo "Application Health:"
curl -s http://localhost:5000/api/health || echo "Health check failed"
echo ""
echo "System Resources:"
free -h
df -h
echo ""
echo "Recent Logs:"
tail -n 10 /var/log/zaura-health/deploy.log
EOF

chmod +x /home/ec2-user/status.sh
chown ec2-user:ec2-user /home/ec2-user/status.sh

# Create update script
cat > /home/ec2-user/update.sh << 'EOF'
#!/bin/bash
echo "Updating Zaura Health application..."
cd /opt/zaura-health
sudo -u ec2-user /opt/zaura-health/scripts/deploy.sh
EOF

chmod +x /home/ec2-user/update.sh
chown ec2-user:ec2-user /home/ec2-user/update.sh

log "EC2 setup completed successfully!"
log "Next steps:"
log "1. Deploy your application code to $APP_DIR"
log "2. Run ./status.sh to check application status"
log "3. Use ./update.sh to update the application"
log ""
log "Application will be available at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"