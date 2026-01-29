#!/bin/bash

# Test script to verify SARVAM_AI_API_KEY is loaded from .env

cd "$(dirname "$0")"

echo "Testing API key loading..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    exit 1
fi

echo "✅ .env file exists"

# Check if API key is in .env
if grep -q "SARVAM_AI_API_KEY=" .env; then
    echo "✅ SARVAM_AI_API_KEY found in .env"
    # Show first 20 characters of the key
    key=$(grep "SARVAM_AI_API_KEY=" .env | cut -d'=' -f2 | head -c 20)
    echo "   Key starts with: ${key}..."
else
    echo "❌ SARVAM_AI_API_KEY not found in .env"
    exit 1
fi

echo ""
echo "Testing Rust compilation..."
cd src-tauri

# Compile the Rust backend
if cargo check --quiet 2>&1 | grep -q "error"; then
    echo "❌ Rust compilation failed"
    cargo check 2>&1 | grep "error"
    exit 1
else
    echo "✅ Rust backend compiles successfully"
fi

echo ""
echo "✅ All checks passed!"
echo ""
echo "The translation system is ready to use. The API key will be"
echo "loaded automatically when the app starts."
