# Terraform configuration for Zaura Health AWS deployment
# Provider and backend configuration

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state storage (uncomment and configure for production)
  # backend "s3" {
  #   bucket         = "zaura-health-terraform-state"
  #   key            = "infrastructure/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "zaura-health-terraform-locks"
  #   encrypt        = true
  # }
}

# AWS Provider configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "Terraform"
    }
  }
}