#!/bin/bash
# User data script for EC2 instance initialization
# This script runs when the instance first boots

set -e

# Update system
yum update -y

# Install Docker
amazon-linux-extras install docker -y
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Git
yum install git -y

# Install Python 3 and pip (backup option)
yum install python3 python3-pip -y

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

# Install CloudWatch agent (free tier compatible)
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

# Create application directory
mkdir -p /opt/zaura-health
chown ec2-user:ec2-user /opt/zaura-health

# Create logs directory
mkdir -p /var/log/zaura-health
chown ec2-user:ec2-user /var/log/zaura-health

# Install Nginx for reverse proxy
amazon-linux-extras install nginx1 -y
systemctl enable nginx

# Create basic Nginx configuration
cat > /etc/nginx/conf.d/zaura-health.conf << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
        }
    }
}
EOF

# Start Nginx
systemctl start nginx

# Create systemd service for the application
cat > /etc/systemd/system/zaura-health.service << 'EOF'
[Unit]
Description=Zaura Health Drug Interaction API
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/zaura-health
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
User=ec2-user
Group=ec2-user

[Install]
WantedBy=multi-user.target
EOF

# Enable the service
systemctl enable zaura-health

# Create deployment script
cat > /opt/zaura-health/deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "Starting deployment..."

# Pull latest code (will be done by GitHub Actions)
cd /opt/zaura-health

# Stop existing containers
docker-compose down || true

# Pull latest images
docker-compose pull || docker build -t zaura-health:latest .

# Start new containers
docker-compose up -d

# Wait for health check
sleep 30
curl -f http://localhost:5000/api/health || exit 1

echo "Deployment completed successfully!"
EOF

chmod +x /opt/zaura-health/deploy.sh
chown ec2-user:ec2-user /opt/zaura-health/deploy.sh

# Signal completion
/opt/aws/bin/cfn-signal -e $? --stack ${project_name}-${environment} --resource AppServer --region $(curl -s http://169.254.169.254/latest/meta-data/placement/region) || true

echo "EC2 initialization completed!"