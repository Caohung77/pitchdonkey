# Bulk Contact Enrichment Setup Guide

## 🔧 Required Setup Steps

### 1. Add Environment Variables

Update your `.env.local` file with your Perplexity API key:

```bash
# AI Services Configuration
PERPLEXITY_API_KEY=pplx-your-actual-api-key-here
```

**Get your Perplexity API key from**: https://www.perplexity.ai/settings/api

### 2. Apply Database Migration

Run this SQL in your Supabase dashboard (SQL Editor):

```sql
-- Copy and paste the contents of: apply-bulk-enrichment-migration.sql
-- This creates the bulk_enrichment_jobs table and adds enrichment fields
```

**Or use the Supabase CLI** (if you have it set up):
```bash
npx supabase db reset  # if using local development
```

### 3. Restart Development Server

After adding the API key, restart your server:

```bash
# Stop the server (Ctrl+C) then restart
npm run dev
```

## 🧪 Testing the System

1. **Go to**: http://localhost:3004/dashboard/contacts
2. **Add some test contacts** with website URLs (if you don't have any)
3. **Select contacts** using checkboxes
4. **Click "Enrich Selected"** - the blue button should now work without errors
5. **Configure and start** enrichment
6. **Watch real-time progress** as contacts are enriched

## 🐛 Troubleshooting

### Error: "PERPLEXITY_API_KEY environment variable is required"
- ✅ Add your Perplexity API key to `.env.local`
- ✅ Restart the development server

### Error: "relation 'bulk_enrichment_jobs' does not exist"
- ✅ Run the database migration SQL in Supabase dashboard

### Error: "No contacts eligible for enrichment"
- ✅ Make sure your contacts have website URLs
- ✅ Check that websites are valid URLs (e.g., "example.com" or "https://example.com")

### API Returns 400/500 Errors
- ✅ Check server console logs for detailed error messages
- ✅ Verify Supabase connection is working
- ✅ Ensure user is authenticated

## 📊 Expected Behavior

When working correctly:

1. **Select contacts** → Blue "Enrich Selected" button appears
2. **Click button** → Modal opens showing contact eligibility
3. **Start enrichment** → Progress modal opens with real-time updates
4. **Wait for completion** → Contact cards update with enrichment badges
5. **View results** → Enriched data visible in contact details

## 🎯 System Features

- ✅ **Smart Eligibility** - Only enriches contacts with websites
- ✅ **Batch Processing** - Processes 3-5 contacts at once
- ✅ **Rate Limiting** - 2-second delays between API calls
- ✅ **Error Handling** - Retries failed contacts automatically  
- ✅ **Real-time Updates** - Live progress tracking
- ✅ **Job Cancellation** - Cancel long-running jobs
- ✅ **Visual Indicators** - Status badges on contact cards

Your bulk enrichment system should now work perfectly! 🚀