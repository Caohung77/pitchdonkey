#!/bin/bash

# Test script for SMTP campaign scheduling issue
# This script will repeatedly call the cron endpoint to test scheduling

echo "🧪 Testing SMTP Campaign Scheduling"
echo "====================================="

# Function to call the cron endpoint
test_cron() {
    echo "⏰ $(date): Triggering cron job..."
    response=$(curl -s -X POST http://localhost:3003/api/cron/process-campaigns)
    echo "📊 Response: $response"
    echo ""
}

# Function to check campaign status via API
check_campaigns() {
    echo "🔍 Checking campaign status..."
    # This would need authentication, but gives us an idea
    echo "📝 Manual check: Go to http://localhost:3003/dashboard/campaigns to see campaign status"
    echo ""
}

echo "🚀 Starting test loop..."
echo "💡 Instructions:"
echo "1. Open http://localhost:3003/dashboard/campaigns/new in your browser"
echo "2. Create a new SMTP campaign scheduled for 2-3 minutes from now"
echo "3. Watch this script monitor for the campaign processing"
echo ""

# Run the cron job every 30 seconds for testing
for i in {1..20}; do
    echo "🔄 Test iteration $i/20"
    test_cron
    check_campaigns

    if [ $i -lt 20 ]; then
        echo "⏳ Waiting 30 seconds before next check..."
        sleep 30
    fi
done

echo "✅ Test completed!"
echo "📋 Next steps:"
echo "1. Check the campaign status in your dashboard"
echo "2. Look at the cron job responses above"
echo "3. If campaign is still not sending, we'll debug the database query"