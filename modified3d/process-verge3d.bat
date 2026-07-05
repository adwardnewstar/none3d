@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Verge3D Process Tool

echo.
echo ====================================
echo    Verge3D Project Processor
echo ====================================
echo.

:: drag & drop mode
if not "%~1"=="" (
    set "SRC_DIR=%~1"
    goto :process
)

:: interactive mode
set /p SRC_DIR=Enter Verge3D project folder path: 

if "%SRC_DIR%"=="" (
    echo No input. Exiting.
    pause
    exit /b 1
)
set "SRC_DIR=%SRC_DIR:"=%"

:process
if not exist "%SRC_DIR%" (
    echo Error: folder not found - %SRC_DIR%
    pause
    exit /b 1
)

for %%i in ("%SRC_DIR%") do set "PROJECT_NAME=%%~nxi"
echo Project: %PROJECT_NAME%
echo Source:  %SRC_DIR%
echo.

node process-verge3d.cjs "%SRC_DIR%"

if !ERRORLEVEL! equ 0 (
    for %%i in ("%SRC_DIR%") do set "SRC_PARENT=%%~dpi"
    set "SRC_ZIP=!SRC_PARENT!%PROJECT_NAME%-processed.zip"
    set "DST_ZIP=%~dp0%PROJECT_NAME%-processed.zip"

    if exist "!SRC_ZIP!" (
        copy /y "!SRC_ZIP!" "!DST_ZIP!" >nul
    )

    echo.
    echo ====================================
    echo  Done!
    echo  Output: !DST_ZIP!
    echo ====================================
) else (
    echo.
    echo Failed. Make sure Node.js is installed.
)

echo.
pause
endlocal
