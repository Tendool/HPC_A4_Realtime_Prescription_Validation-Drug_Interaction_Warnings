@echo off
REM Zaura Health - Setup Script
REM Professional drug interaction analysis platform setup

echo.
echo   =======================================
echo   Zaura Health Setup Script
echo   =======================================
echo   Setting up your AI-powered drug interaction analysis platform
echo.

REM Check if conda is available
where conda >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Conda not found. Please install Anaconda or Miniconda first.
    echo Download from: https://docs.conda.io/en/latest/miniconda.html
    pause
    exit /b 1
)

echo [1/4] Creating conda environment...
conda create -n torchgpu python=3.8 pytorch torchvision torchaudio pytorch-cuda=11.8 -c pytorch -c nvidia -y

echo [2/4] Activating environment...
call conda activate torchgpu

echo [3/4] Installing Python dependencies...
pip install -r requirements.txt

echo [4/4] Verifying installation...
python -c "import torch; print(f'PyTorch version: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}')"

echo.
echo =======================================
echo   Setup Complete!
echo =======================================
echo.
echo To start Zaura Health:
echo   1. Run: run.bat
echo   2. Open browser: http://localhost:5000
echo.
echo Powered by Z Corp.(R) AI Technology
echo.
pause