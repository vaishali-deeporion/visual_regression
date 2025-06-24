#!/bin/bash

echo "🚀 Setting up Visual Regression Testing for deployment..."

# Set environment variables for Puppeteer
export PUPPETEER_CACHE_DIR="/tmp/puppeteer_cache"
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

# Create cache directory
echo "📁 Creating Puppeteer cache directory..."
mkdir -p $PUPPETEER_CACHE_DIR

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Install Chrome for Puppeteer with explicit cache directory
echo "🌐 Installing Chrome for Puppeteer..."
npx puppeteer browsers install chrome --cache-dir=$PUPPETEER_CACHE_DIR

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p backstop_data/bitmaps_reference
mkdir -p backstop_data/bitmaps_test
mkdir -p backstop_data/html_report
mkdir -p backstop_data/ci_report
mkdir -p uploads

# Set permissions
echo "🔐 Setting permissions..."
chmod -R 755 backstop_data
chmod -R 755 uploads
chmod -R 755 $PUPPETEER_CACHE_DIR

# Verify Chrome installation
echo "🔍 Verifying Chrome installation..."
if npx puppeteer browsers list | grep -q "chrome"; then
    echo "✅ Chrome installed successfully"
else
    echo "❌ Chrome installation failed. Trying alternative method..."
    npx puppeteer browsers install chrome --cache-dir=$PUPPETEER_CACHE_DIR --force
fi

echo "✅ Deployment setup complete!"
echo "🎯 You can now start the application with: npm start"
echo "📝 Environment variables set:"
echo "   - PUPPETEER_CACHE_DIR: $PUPPETEER_CACHE_DIR" 