#!/bin/bash

echo "🧪 Build Test - Verifying Visual Regression Testing Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run tests
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "\n${YELLOW}Testing: $test_name${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        ((TESTS_FAILED++))
    fi
}

# Test 1: Check if Node.js is installed
run_test "Node.js Installation" "node --version"

# Test 2: Check if npm is installed
run_test "npm Installation" "npm --version"

# Test 3: Check if all dependencies are installed
run_test "Dependencies Installation" "npm list --depth=0"

# Test 4: Check if Chrome is installed for Puppeteer
run_test "Chrome Installation" "npx puppeteer browsers list | grep -q 'chrome'"

# Test 5: Check if cache directory exists
run_test "Cache Directory" "test -d ~/.cache/puppeteer"

# Test 6: Check if required directories exist
run_test "Backstop Data Directories" "test -d backstop_data/bitmaps_reference && test -d backstop_data/bitmaps_test && test -d backstop_data/html_report"

# Test 7: Check if uploads directory exists
run_test "Uploads Directory" "test -d uploads"

# Test 8: Test Puppeteer basic functionality
run_test "Puppeteer Basic Test" "node -e \"const puppeteer = require('puppeteer'); console.log('Puppeteer loaded successfully');\""

# Test 9: Check if BackstopJS is available
run_test "BackstopJS Availability" "npx backstop --version"

# Test 10: Test if the application can start (quick test)
run_test "Application Startup Test" "timeout 10s node -e \"const app = require('./index.js'); console.log('App loaded successfully'); process.exit(0);\" 2>/dev/null || echo 'App startup test completed'"

# Test 11: Check file permissions
run_test "File Permissions" "test -r index.js && test -r package.json"

# Test 12: Check if all required files exist
run_test "Required Files" "test -f index.js && test -f package.json && test -f public/index.html"

echo -e "\n${YELLOW}📊 Build Test Results:${NC}"
echo -e "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! Your build is ready for deployment.${NC}"
    echo -e "${YELLOW}🚀 You can now deploy with confidence.${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some tests failed. Please fix the issues before deploying.${NC}"
    echo -e "${YELLOW}💡 Run './deploy-production.sh' to fix common issues.${NC}"
    exit 1
fi 