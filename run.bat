@echo off
REM Zaura Health - Windows Launch Script
REM Professional drug interaction analysis platform

echo.
echo   ========================================
echo   Zaura Health - Starting Application
echo   ========================================
echo   Powered by Z Corp.(R) AI Technology
echo.

REM Check if conda is available
where conda >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Conda not found. Please install Anaconda or Miniconda.
    echo Download from: https://docs.conda.io/en/latest/miniconda.html
    pause
    exit /b 1
)

REM Check if torchgpu environment exists
conda env list | findstr "torchgpu" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Conda environment 'torchgpu' not found.
    echo Please create the environment first:
    echo   conda create -n torchgpu python=3.8 pytorch torchvision torchaudio pytorch-cuda=11.8 -c pytorch -c nvidia
    pause
    exit /b 1
)

echo [INFO] Activating conda environment: torchgpu
call conda activate torchgpu

echo [INFO] Installing required packages...
pip install -r requirements.txt --quiet

echo [INFO] Checking model files...
if not exist "models\enhanced_model_info.pkl" (
    echo [ERROR] Model files not found in models\ directory
    echo Please ensure the following files are present:
    echo   - enhanced_model_info.pkl
    echo   - enhanced_drug_interaction_preprocessor.pkl  
    echo   - best_enhanced_drug_interaction_model.pth
    pause
    exit /b 1
)

echo [INFO] Starting Zaura Health Web Application...
echo [INFO] Access the application at: http://localhost:5000
echo [INFO] Press Ctrl+C to stop the server
echo.

python app.py

echo.
echo [INFO] Zaura Health application stopped.
pause