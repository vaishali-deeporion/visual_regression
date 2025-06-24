#!/bin/bash

echo "🔧 Installing Chrome for Puppeteer in deployment environment..."

# Create the cache directory that Puppeteer expects
mkdir -p /opt/render/.cache/puppeteer

# Set environment variables
export PUPPETEER_CACHE_DIR="/opt/render/.cache/puppeteer"
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

# Install Chrome for Puppeteer
echo "📦 Installing Chrome..."
npx puppeteer browsers install chrome --cache-dir=$PUPPETEER_CACHE_DIR

# Verify installation
echo "🔍 Verifying Chrome installation..."
if npx puppeteer browsers list | grep -q "chrome"; then
    echo "✅ Chrome installed successfully"
    echo "📁 Cache directory: $PUPPETEER_CACHE_DIR"
else
    echo "❌ Chrome installation failed. Trying alternative method..."
    npx puppeteer browsers install chrome --cache-dir=$PUPPETEER_CACHE_DIR --force
fi

# Set permissions
chmod -R 755 $PUPPETEER_CACHE_DIR

echo "✅ Chrome installation complete!" 