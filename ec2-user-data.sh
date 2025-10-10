#!/bin/bash
# User Data Script for Amazon Linux 2023
# Zaura Health Application Setup

# Update system
yum update -y

# Install Docker
yum install -y docker

# Install Git, Python3, and pip
yum install -y git python3 python3-pip

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Add ec2-user to docker group
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create symbolic link for docker-compose
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
yum install -y unzip
unzip awscliv2.zip
./aws/install

# Create application directory
mkdir -p /opt/zaura-health
chown ec2-user:ec2-user /opt/zaura-health
chmod 755 /opt/zaura-health

# Install additional Python packages that might be needed
pip3 install --upgrade pip
pip3 install boto3 psycopg2-binary flask gunicorn

# Create a completion marker
echo "EC2 setup completed at $(date)" > /opt/zaura-health/setup-complete.log
chown ec2-user:ec2-user /opt/zaura-health/setup-complete.log

# Log setup completion
echo "Zaura Health EC2 setup complete. Ready for application deployment." >> /var/log/user-data.log