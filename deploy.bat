@echo off
echo ========================================
echo 🚀 ZAURA HEALTH - INSTANT DEPLOYMENT
echo ========================================
echo.
echo This script will prepare your repository for GitHub Actions deployment
echo with PostgreSQL RDS and EC2 infrastructure!
echo.
echo Prerequisites:
echo 1. GitHub repository created
echo 2. AWS account with free tier access
echo 3. GitHub secrets configured (see DEPLOY_NOW.md)
echo.

pause

echo.
echo 📁 Initializing Git Repository...
git init
if %errorlevel% neq 0 (
    echo ❌ Git initialization failed
    pause
    exit /b 1
)

echo.
echo 📝 Adding all files to Git...
git add .
if %errorlevel% neq 0 (
    echo ❌ Git add failed
    pause
    exit /b 1
)

echo.
echo 💾 Creating initial commit...
git commit -m "🚀 Initial commit: Zaura Health with PostgreSQL RDS deployment ready"
if %errorlevel% neq 0 (
    echo ❌ Git commit failed
    pause
    exit /b 1
)

echo.
echo 🌐 Setting up remote repository...
echo Please enter your GitHub repository URL (e.g., https://github.com/username/zaura-health.git):
set /p REPO_URL=

if "%REPO_URL%"=="" (
    echo ❌ No repository URL provided
    pause
    exit /b 1
)

git remote add origin %REPO_URL%
if %errorlevel% neq 0 (
    echo ❌ Failed to add remote origin
    pause
    exit /b 1
)

echo.
echo 🔐 IMPORTANT: Before pushing, ensure GitHub secrets are configured!
echo.
echo Required secrets in your GitHub repository:
echo - AWS_ACCESS_KEY_ID
echo - AWS_SECRET_ACCESS_KEY  
echo - EC2_SSH_PRIVATE_KEY
echo - EC2_SSH_PUBLIC_KEY
echo - EC2_KEY_NAME
echo - SECRET_KEY
echo.
echo See DEPLOY_NOW.md for detailed instructions.
echo.

set /p SECRETS_READY=Have you configured all GitHub secrets? (y/n): 

if /i "%SECRETS_READY%" neq "y" (
    echo.
    echo ⚠️ Please configure GitHub secrets first, then run:
    echo    git push -u origin main
    echo.
    echo See DEPLOY_NOW.md for complete instructions.
    pause
    exit /b 0
)

echo.
echo 🚀 DEPLOYING TO GITHUB...
echo This will trigger the GitHub Actions workflow automatically!
echo.

git push -u origin main
if %errorlevel% neq 0 (
    echo ❌ Git push failed - check your repository URL and permissions
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ DEPLOYMENT INITIATED SUCCESSFULLY!
echo ========================================
echo.
echo 🎯 Next Steps:
echo 1. Go to your GitHub repository
echo 2. Click the "Actions" tab
echo 3. Watch the "Deploy EC2 with RDS" workflow
echo 4. Deployment will take 15-20 minutes
echo.
echo 📊 Expected Infrastructure:
echo - EC2 t2.micro instance
echo - PostgreSQL RDS db.t3.micro  
echo - VPC with security groups
echo - CloudWatch monitoring
echo.
echo 💰 Cost: FREE (AWS Free Tier)
echo ⏱️ ETA: 15-20 minutes
echo.
echo Check GitHub Actions for real-time progress!
echo.

pause