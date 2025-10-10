#!/bin/bash

# Quick deployment verification and setup
echo "🚀 ZAURA HEALTH - DEPLOYMENT VERIFICATION"
echo "=========================================="

# Check if required files exist
echo "📁 Checking required deployment files..."

required_files=(
    "terraform-ec2/main.tf"
    "terraform-ec2/rds.tf" 
    "terraform-ec2/variables.tf"
    "terraform-ec2/outputs.tf"
    "terraform-ec2/terraform.tfvars"
    ".github/workflows/deploy-ec2.yml"
    "app_rds.py"
    "Dockerfile.rds"
    "database/postgres_manager.py"
    "docker-compose.yml"
    "requirements.txt"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        missing_files+=("$file")
    else
        echo "✅ $file"
    fi
done

if [[ ${#missing_files[@]} -gt 0 ]]; then
    echo ""
    echo "❌ Missing required files:"
    for file in "${missing_files[@]}"; do
        echo "   - $file"
    done
    exit 1
else
    echo ""
    echo "✅ All required files present!"
fi

echo ""
echo "🔧 Infrastructure Summary:"
echo "- EC2: t2.micro (Free Tier)"
echo "- RDS: db.t3.micro PostgreSQL (Free Tier)" 
echo "- VPC: Custom with 2 subnets"
echo "- Security: Encrypted RDS, VPC isolation"
echo "- Monitoring: CloudWatch basic metrics"

echo ""
echo "💰 Expected Costs:"
echo "- First 12 months: $0-5/month (Free Tier)"
echo "- After free tier: ~$20-25/month"

echo ""
echo "🚀 Ready for deployment!"
echo ""
echo "Next steps:"
echo "1. Configure GitHub repository secrets"
echo "2. Run: git add . && git commit -m 'Deploy' && git push origin main"
echo "3. Monitor GitHub Actions workflow"
echo ""
echo "See DEPLOY_NOW.md for complete instructions!"

# Generate a unique Flask secret key
echo ""
echo "🔐 Generated Flask SECRET_KEY for GitHub secrets:"
python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || python -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || echo "Run: python -c \"import secrets; print(secrets.token_hex(32))\""