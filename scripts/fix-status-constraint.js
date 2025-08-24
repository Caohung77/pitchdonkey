#!/usr/bin/env node

/**
 * Fix Status Constraint for Simple Campaigns
 * This script fixes the campaigns_status_check constraint to allow 'sending' and 'scheduled' statuses
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

async function fixConstraint() {
  console.log('🔧 Fixing campaigns status constraint...');
  
  try {
    // Test current constraint by trying to create a record with 'sending' status
    console.log('🧪 Testing current constraint...');
    
    const testData = {
      name: 'Constraint Test - DELETE ME',
      email_subject: 'Test',
      html_content: '<p>Test</p>',
      status: 'sending' // This should fail with current constraint
    };
    
    const { data: testResult, error: testError } = await supabase
      .from('campaigns')
      .insert(testData)
      .select()
      .single();
    
    if (testError) {
      if (testError.message.includes('campaigns_status_check')) {
        console.log('❌ Confirmed: Status constraint needs fixing');
        console.log('Error:', testError.message);
      } else {
        console.log('⚠️  Different error occurred:', testError.message);
        return;
      }
    } else {
      console.log('✅ Status constraint already allows "sending" - cleaning up test record');
      await supabase.from('campaigns').delete().eq('id', testResult.id);
      return;
    }
    
    // Try to fix the constraint using a workaround
    // Since we can't run ALTER TABLE directly, we'll check what statuses are actually needed
    console.log('');
    console.log('🚨 MANUAL FIX REQUIRED');
    console.log('The status constraint needs to be updated manually in Supabase Dashboard.');
    console.log('');
    console.log('Please run this SQL in Supabase Dashboard → SQL Editor:');
    console.log('');
    console.log('-- Drop the existing constraint');
    console.log('ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;');
    console.log('');
    console.log('-- Add the updated constraint');
    console.log("ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check CHECK (");
    console.log("    status IN ('draft', 'active', 'paused', 'completed', 'archived', 'sending', 'scheduled')");
    console.log(");");
    console.log('');
    console.log('This will fix the "Send Now" functionality in your simple campaigns.');
    
  } catch (error) {
    console.error('❌ Script error:', error.message);
  }
}

fixConstraint();