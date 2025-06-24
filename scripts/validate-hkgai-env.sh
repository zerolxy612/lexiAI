#!/bin/bash

# HKGAI Environment Variables Validation Script
# This script helps validate your HKGAI model configuration

echo "🔍 HKGAI Environment Variables Validation"
echo "========================================"
echo

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found in current directory"
    echo "   Please ensure you're running this script from the project root"
    exit 1
fi

echo "✅ Found .env file"
echo

# Load environment variables from .env file
export $(cat .env | grep -v '^#' | xargs) 2>/dev/null

# Define expected environment variables
declare -a expected_vars=(
    "HKGAI_RAG_API_KEY"
    "HKGAI_CONTRACT_API_KEY"
    "HKGAI_GENERAL_API_KEY"
    "HKGAI_SEARCHENTRY_API_KEY"
    "HKGAI_MISSINGINFO_API_KEY"
    "HKGAI_TIMELINE_API_KEY"
    "HKGAI_CASE_SEARCH_API_KEY"
    "HKGAI_CODE_SEARCH_API_KEY"
    "HKGAI_API_KEY"
)

# Check each environment variable
echo "📋 Environment Variables Status:"
echo "--------------------------------"

found_count=0
total_count=${#expected_vars[@]}

for var in "${expected_vars[@]}"; do
    if [ -n "${!var}" ]; then
        # Variable is set
        value="${!var}"
        masked_value="${value:0:8}..."
        echo "✅ $var: $masked_value"
        ((found_count++))
    else
        # Variable is not set
        echo "❌ $var: NOT SET"
    fi
done

echo
echo "📊 Summary:"
echo "----------"
echo "Found: $found_count/$total_count environment variables"

# Check if we have at least the fallback key or specific keys
if [ -n "$HKGAI_API_KEY" ]; then
    echo "✅ Global fallback key (HKGAI_API_KEY) is configured"
    echo "✅ Configuration is valid (fallback key available)"
elif [ $found_count -ge 7 ]; then
    echo "✅ Configuration is valid (specific keys available)"
else
    echo "❌ Configuration is incomplete"
    echo "   Either set HKGAI_API_KEY as a fallback, or configure specific model keys"
fi

echo

# Check nodemon configuration
echo "🔧 Checking API Server Configuration:"
echo "------------------------------------"

nodemon_file="apps/api/nodemon.json"
if [ -f "$nodemon_file" ]; then
    if grep -q "env-file=../../.env" "$nodemon_file"; then
        echo "✅ nodemon.json: Environment file path is correct"
    elif grep -q "env-file=.env" "$nodemon_file"; then
        echo "⚠️  nodemon.json: Environment file path may be incorrect"
        echo "   Found: --env-file=.env"
        echo "   Should be: --env-file=../../.env"
    else
        echo "❌ nodemon.json: No environment file configuration found"
    fi
else
    echo "❌ nodemon.json: Configuration file not found"
fi

echo

# Provide recommendations
echo "💡 Recommendations:"
echo "------------------"

if [ $found_count -lt $total_count ] && [ -z "$HKGAI_API_KEY" ]; then
    echo "1. Set missing environment variables in .env file"
    echo "2. Ensure all variable names use UPPERCASE letters"
    echo "3. Restart API server after making changes"
fi

if [ -f "$nodemon_file" ] && ! grep -q "env-file=../../.env" "$nodemon_file"; then
    echo "4. Fix nodemon.json configuration:"
    echo "   Change: --env-file=.env"
    echo "   To: --env-file=../../.env"
fi

echo "5. After making changes, restart the API server:"
echo "   pkill -f \"pnpm.*api.*dev\" && cd apps/api && pnpm dev"

echo
echo "📖 For detailed troubleshooting, see:"
echo "   ./TROUBLESHOOTING_HKGAI_MODELS.md"
echo

# Final status
if [ -n "$HKGAI_API_KEY" ] || [ $found_count -ge 7 ]; then
    echo "🎉 Overall Status: READY"
    exit 0
else
    echo "⚠️  Overall Status: NEEDS ATTENTION"
    exit 1
fi 