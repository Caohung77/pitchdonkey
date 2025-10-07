#!/bin/bash

# Test email fetching debug endpoint
# First, get the session cookie from your browser or use Supabase auth

echo "🔍 Testing email fetch debugging..."
echo ""
echo "Please follow these steps:"
echo "1. Open your browser to http://localhost:3001"
echo "2. Log in to your account"
echo "3. Open browser DevTools (F12)"
echo "4. Go to Console and run this command:"
echo ""
echo "fetch('/api/inbox/debug-fetch?accountId=YOUR_EMAIL_ACCOUNT_ID').then(r => r.json()).then(console.log)"
echo ""
echo "Replace YOUR_EMAIL_ACCOUNT_ID with your actual email account ID from the Email Accounts page"
echo ""
echo "This will show you:"
echo "- Total emails fetched from Gmail API"
echo "- Which emails are being filtered as 'self-sent'"
echo "- Breakdown by sender domain"
echo "- Full list of emails with their details"
