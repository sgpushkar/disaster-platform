#!/usr/bin/env bash
set -e

echo "========================================================"
echo "    AI Disaster Platform - 1-Click Automated Setup"
echo "========================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "✖ Error: Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "✖ Error: Python 3 is not installed. Please install Python 3.10+ from https://www.python.org/"
    exit 1
fi

echo "[1/3] Installing root dependencies..."
npm install --no-audit --no-fund

echo ""
echo "[2/3] Running automated environment setup and ML model checker..."
node setup.js

echo ""
read -p "Do you want to start the platform right now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting platform..."
    npm run dev
fi
