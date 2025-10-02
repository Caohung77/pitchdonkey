#!/bin/bash

# Test Batch Scheduling System
# This script:
# 1. Verifies Supabase database schema
# 2. Runs unit tests for batch scheduling
# 3. Provides manual E2E test instructions
# 4. Generates comprehensive test report

set -e  # Exit on error

echo "🧪 ===== BATCH SCHEDULING SYSTEM TEST SUITE ====="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print section header
print_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Function to print test result
print_result() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ "$1" == "pass" ]; then
        echo -e "${GREEN}✓${NC} $2"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    elif [ "$1" == "fail" ]; then
        echo -e "${RED}✗${NC} $2"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    else
        echo -e "${YELLOW}⚠${NC} $2"
    fi
}

# ===== TEST 1: Database Schema Verification =====
print_section "1. Database Schema Verification"

echo "Checking if batch_schedule column exists in campaigns table..."

# Check migration file exists
if [ -f "supabase/migrations/20251002_add_batch_schedule.sql" ]; then
    print_result "pass" "Migration file exists: 20251002_add_batch_schedule.sql"
else
    print_result "fail" "Migration file not found"
fi

echo ""
echo -e "${YELLOW}📋 Manual Verification Required:${NC}"
echo "Please verify in Supabase Dashboard SQL Editor:"
echo ""
echo "SELECT column_name, data_type, is_nullable"
echo "FROM information_schema.columns"
echo "WHERE table_name = 'campaigns'"
echo "  AND column_name = 'batch_schedule';"
echo ""
echo "Expected result:"
echo "  column_name     | data_type | is_nullable"
echo "  batch_schedule  | jsonb     | YES"
echo ""

read -p "Does the batch_schedule column exist? (y/n): " schema_verified

if [ "$schema_verified" == "y" ]; then
    print_result "pass" "Database schema verified by user"
else
    print_result "fail" "Database schema not verified"
    echo ""
    echo -e "${RED}⚠️  Please run the migration:${NC}"
    echo "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_schedule JSONB DEFAULT NULL;"
    echo "CREATE INDEX IF NOT EXISTS idx_campaigns_batch_schedule ON campaigns USING gin (batch_schedule);"
fi

# ===== TEST 2: Unit Tests =====
print_section "2. Unit Tests - Batch Scheduling Logic"

echo "Running Jest tests for batch scheduling..."
echo ""

if npm test -- --testPathPattern=batch-scheduling.test.ts --verbose; then
    print_result "pass" "All unit tests passed"
else
    print_result "fail" "Some unit tests failed"
fi

# ===== TEST 3: Integration Test Setup =====
print_section "3. Integration Test Instructions"

echo -e "${YELLOW}📝 Manual Integration Test:${NC}"
echo ""
echo "Follow these steps to verify end-to-end batch scheduling:"
echo ""
echo "STEP 1: Create Test Campaign"
echo "  1. Go to http://localhost:3002/dashboard/campaigns/simple/new"
echo "  2. Select 10 contacts"
echo "  3. Set batch size to 5 (creates 2 batches)"
echo "  4. Schedule for 'now' or 1 minute from now"
echo "  5. Submit campaign"
echo ""
echo "STEP 2: Verify Batch Schedule Created"
echo "  Run this query in Supabase:"
echo "  SELECT id, name, batch_schedule, next_batch_send_time, status"
echo "  FROM campaigns"
echo "  ORDER BY created_at DESC"
echo "  LIMIT 1;"
echo ""
echo "  Expected batch_schedule structure:"
echo "  {"
echo "    \"batches\": ["
echo "      {\"batch_number\": 1, \"scheduled_time\": \"...\", \"status\": \"pending\", ...},"
echo "      {\"batch_number\": 2, \"scheduled_time\": \"...\", \"status\": \"pending\", ...}"
echo "    ],"
echo "    \"batch_size\": 5,"
echo "    \"total_batches\": 2,"
echo "    \"total_contacts\": 10"
echo "  }"
echo ""
echo "STEP 3: Monitor First Batch Execution"
echo "  - Wait for scheduled time or trigger cron manually"
echo "  - Check logs for: '📧 Processing batch 1/2'"
echo "  - Verify 5 emails sent"
echo "  - Check batch_schedule updated: batch 1 status = 'sent'"
echo "  - Verify next_batch_send_time points to batch 2"
echo ""
echo "STEP 4: Monitor Second Batch Execution"
echo "  - Wait 20 minutes (or time until batch 2 scheduled_time)"
echo "  - Trigger cron job or wait for automatic execution"
echo "  - Check logs for: '📧 Processing batch 2/2'"
echo "  - Verify remaining 5 emails sent"
echo "  - Campaign status should be 'completed'"
echo ""
echo "STEP 5: Verify Campaign Completion"
echo "  Run this query:"
echo "  SELECT status, emails_sent, batch_schedule->'batches'"
echo "  FROM campaigns"
echo "  WHERE id = '<your-campaign-id>';"
echo ""
echo "  Expected:"
echo "  - status: 'completed'"
echo "  - emails_sent: 10"
echo "  - All batches have status: 'sent'"
echo ""

read -p "Did the integration test pass? (y/n/skip): " integration_verified

if [ "$integration_verified" == "y" ]; then
    print_result "pass" "Integration test verified by user"
elif [ "$integration_verified" == "n" ]; then
    print_result "fail" "Integration test failed"
else
    print_result "warn" "Integration test skipped"
fi

# ===== TEST 4: Cron Job Configuration =====
print_section "4. Cron Job Configuration"

echo "Verifying cron job setup..."
echo ""

# Check if cron endpoint exists
if [ -f "src/app/api/cron/process-campaigns/route.ts" ]; then
    print_result "pass" "Cron endpoint exists"
else
    print_result "fail" "Cron endpoint not found"
fi

# Check campaign processor
if [ -f "lib/campaign-processor.ts" ]; then
    print_result "pass" "Campaign processor exists"

    # Check for batch schedule logic
    if grep -q "batch_schedule?.batches" lib/campaign-processor.ts; then
        print_result "pass" "Batch schedule logic implemented"
    else
        print_result "fail" "Batch schedule logic not found"
    fi
else
    print_result "fail" "Campaign processor not found"
fi

echo ""
echo -e "${YELLOW}📋 Cron Job Configuration:${NC}"
echo ""
echo "Your Ubuntu server should have this cron job:"
echo "*/5 * * * * curl -X POST http://localhost:3002/api/cron/process-campaigns"
echo ""
echo "To verify cron is running:"
echo "1. Check cron logs: grep CRON /var/log/syslog"
echo "2. Or manually trigger: curl -X POST http://localhost:3002/api/cron/process-campaigns"
echo ""

read -p "Is cron job configured and running? (y/n): " cron_verified

if [ "$cron_verified" == "y" ]; then
    print_result "pass" "Cron job verified by user"
else
    print_result "fail" "Cron job not configured"
fi

# ===== TEST 5: Processor Logic Verification =====
print_section "5. Campaign Processor Logic"

echo "Checking critical processor logic..."
echo ""

# Check for time-based batch filtering
if grep -q "new Date(batch.scheduled_time) <= now" lib/campaign-processor.ts; then
    print_result "pass" "Time-based batch filtering implemented"
else
    print_result "fail" "Missing time-based batch filtering"
fi

# Check for batch status updates
if grep -q "status: 'sent'" lib/campaign-processor.ts && grep -q "completed_at" lib/campaign-processor.ts; then
    print_result "pass" "Batch status update logic present"
else
    print_result "fail" "Batch status update logic missing"
fi

# Check for next_batch_send_time updates
if grep -q "next_batch_send_time" lib/campaign-processor.ts; then
    print_result "pass" "next_batch_send_time update logic present"
else
    print_result "fail" "next_batch_send_time update logic missing"
fi

# Check for fallback logic when contact_ids is empty
if grep -q "contact_ids.length > 0" lib/campaign-processor.ts; then
    print_result "pass" "Fallback logic for empty contact_ids present"
else
    print_result "warn" "Fallback logic may be missing"
fi

# ===== FINAL REPORT =====
print_section "TEST SUMMARY"

echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

if [ $PASS_RATE -ge 80 ]; then
    echo -e "${GREEN}✓ Test Suite: PASS ($PASS_RATE%)${NC}"
    echo ""
    echo "🎉 Batch scheduling system is properly configured!"
    echo ""
    echo "Next steps:"
    echo "1. Create a test campaign with 10-15 contacts"
    echo "2. Monitor the first batch execution"
    echo "3. Verify second batch triggers after 20 minutes"
    echo "4. Check campaign completion status"
    exit 0
else
    echo -e "${RED}✗ Test Suite: FAIL ($PASS_RATE%)${NC}"
    echo ""
    echo "⚠️  Please review failed tests above"
    echo ""
    echo "Common issues:"
    echo "- Database migration not applied"
    echo "- Cron job not configured"
    echo "- Campaign processor logic missing"
    exit 1
fi
