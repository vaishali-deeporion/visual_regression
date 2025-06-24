#!/bin/bash

echo "🚀 Production Deployment Setup for Visual Regression Testing..."

# Set production environment variables
export PUPPETEER_CACHE_DIR="$HOME/.cache/puppeteer"
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

# Create the production cache directory
echo "📁 Creating production cache directory..."
mkdir -p $PUPPETEER_CACHE_DIR

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Install Chrome in production cache directory
echo "🌐 Installing Chrome for production..."
npx puppeteer browsers install chrome --cache-dir=$PUPPETEER_CACHE_DIR

# Verify Chrome installation
echo "🔍 Verifying Chrome installation..."
if npx puppeteer browsers list | grep -q "chrome"; then
    echo "✅ Chrome installed successfully in production"
    echo "📁 Production cache directory: $PUPPETEER_CACHE_DIR"
else
    echo "❌ Chrome installation failed. Trying with force..."
    npx puppeteer browsers install chrome --cache-dir=$PUPPETEER_CACHE_DIR --force
    
    if npx puppeteer browsers list | grep -q "chrome"; then
        echo "✅ Chrome installed successfully with force flag"
    else
        echo "❌ Chrome installation failed. Please check your production environment."
        exit 1
    fi
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p backstop_data/bitmaps_reference
mkdir -p backstop_data/bitmaps_test
mkdir -p backstop_data/html_report
mkdir -p backstop_data/ci_report
mkdir -p uploads

# Set permissions for production
echo "🔐 Setting production permissions..."
chmod -R 755 backstop_data
chmod -R 755 uploads
chmod -R 755 $PUPPETEER_CACHE_DIR

echo "✅ Production deployment setup complete!"
echo "🎯 You can now start the production application with: npm start"
echo "📝 Production environment configured:"
echo "   - PUPPETEER_CACHE_DIR: $PUPPETEER_CACHE_DIR" 