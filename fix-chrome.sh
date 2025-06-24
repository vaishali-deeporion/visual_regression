#!/bin/bash

echo "🔧 Fixing Chrome installation for Puppeteer..."

# Set environment variables
export PUPPETEER_CACHE_DIR="/tmp/puppeteer_cache"
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

# Create cache directory
mkdir -p $PUPPETEER_CACHE_DIR

# Check if Chrome is already installed
echo "🔍 Checking current Chrome installation..."
if npx puppeteer browsers list | grep -q "chrome"; then
    echo "✅ Chrome is already installed"
else
    echo "❌ Chrome not found. Installing..."
    
    # Try to install Chrome
    npx puppeteer browsers install chrome --cache-dir=$PUPPETEER_CACHE_DIR
    
    # Verify installation
    if npx puppeteer browsers list | grep -q "chrome"; then
        echo "✅ Chrome installed successfully"
    else
        echo "❌ Installation failed. Trying alternative method..."
        
        # Try with force flag
        npx puppeteer browsers install chrome --cache-dir=$PUPPETEER_CACHE_DIR --force
        
        # Final verification
        if npx puppeteer browsers list | grep -q "chrome"; then
            echo "✅ Chrome installed successfully with force flag"
        else
            echo "❌ Chrome installation failed. Please check your environment."
            echo "💡 Try running: npm run setup"
            exit 1
        fi
    fi
fi

# Set permissions
chmod -R 755 $PUPPETEER_CACHE_DIR

echo "✅ Chrome installation check complete!"
echo "📝 Cache directory: $PUPPETEER_CACHE_DIR" 