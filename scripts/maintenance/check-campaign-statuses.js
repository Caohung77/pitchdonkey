#!/usr/bin/env node

/**
 * Check Campaign Statuses
 * This script checks what status values exist in the campaigns table
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStatuses() {
  console.log('🔍 Checking existing campaign statuses...');
  
  try {
    // Get all unique status values from campaigns table
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('id, name, status, created_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching campaigns:', error.message);
      return;
    }
    
    if (!campaigns || campaigns.length === 0) {
      console.log('✅ No campaigns found in database');
      console.log('You can safely apply the constraint now.');
      return;
    }
    
    console.log(`📊 Found ${campaigns.length} campaigns`);
    console.log('');
    
    // Group by status
    const statusCounts = {};
    campaigns.forEach(campaign => {
      statusCounts[campaign.status] = (statusCounts[campaign.status] || 0) + 1;
    });
    
    console.log('📈 Status distribution:');
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`  ${status}: ${count} campaigns`);
    }
    console.log('');
    
    // Check which statuses are valid/invalid
    const validStatuses = ['draft', 'active', 'paused', 'completed', 'archived', 'sending', 'scheduled'];
    const invalidStatuses = Object.keys(statusCounts).filter(status => !validStatuses.includes(status));
    
    if (invalidStatuses.length === 0) {
      console.log('✅ All status values are valid!');
      console.log('You can apply the constraint safely.');
    } else {
      console.log('⚠️  Invalid status values found:');
      invalidStatuses.forEach(status => {
        console.log(`  - "${status}" (${statusCounts[status]} campaigns)`);
      });
      
      console.log('');
      console.log('🔧 You need to update these campaigns first. Here\'s the SQL:');
      console.log('');
      
      // Generate SQL to fix invalid statuses
      invalidStatuses.forEach(invalidStatus => {
        let newStatus = 'draft'; // default
        
        // Try to map to reasonable statuses
        if (invalidStatus === 'sent' || invalidStatus === 'running') {
          newStatus = 'active';
        } else if (invalidStatus === 'stopped') {
          newStatus = 'paused';
        } else if (invalidStatus === 'finished' || invalidStatus === 'done') {
          newStatus = 'completed';
        }
        
        console.log(`-- Fix campaigns with status "${invalidStatus}"`);
        console.log(`UPDATE campaigns SET status = '${newStatus}' WHERE status = '${invalidStatus}';`);
      });
      
      console.log('');
      console.log('After running the UPDATE statements above, you can then apply the constraint:');
      console.log('');
      console.log('ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;');
      console.log('ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check CHECK (');
      console.log("    status IN ('draft', 'active', 'paused', 'completed', 'archived', 'sending', 'scheduled')");
      console.log(');');
    }
    
    // Show some example campaigns
    if (campaigns.length > 0) {
      console.log('');
      console.log('📋 Recent campaigns:');
      campaigns.slice(0, 5).forEach(campaign => {
        console.log(`  ${campaign.id} | ${campaign.status} | ${campaign.name || 'Unnamed'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Script error:', error.message);
  }
}

checkStatuses();