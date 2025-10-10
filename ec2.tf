# Key pair for SSH access (you'll need to create this manually or import existing)
resource "aws_key_pair" "app_key" {
  key_name   = var.key_name
  public_key = file("${path.module}/keys/${var.key_name}.pub")  # You'll need to create this

  tags = {
    Name = "${var.project_name}-${var.environment}-key"
  }

  lifecycle {
    ignore_changes = [public_key]
  }
}

# EC2 Instance
resource "aws_instance" "app_server" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  key_name              = aws_key_pair.app_key.key_name
  vpc_security_group_ids = [aws_security_group.web_sg.id]
  subnet_id             = data.aws_subnet.default.id
  iam_instance_profile  = aws_iam_instance_profile.ec2_profile.name

  # Free tier eligible EBS volume
  root_block_device {
    volume_type = "gp2"
    volume_size = var.volume_size
    encrypted   = true

    tags = {
      Name = "${var.project_name}-${var.environment}-root-volume"
    }
  }

  # Enable detailed monitoring only if specified (may incur costs)
  monitoring = var.enable_monitoring

  # User data script for initial setup
  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    project_name = var.project_name
    environment  = var.environment
  }))

  tags = {
    Name = "${var.project_name}-${var.environment}-server"
    Type = "WebServer"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Elastic IP (free tier includes 1 EIP)
resource "aws_eip" "app_eip" {
  instance = aws_instance.app_server.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-${var.environment}-eip"
  }

  depends_on = [aws_instance.app_server]
}