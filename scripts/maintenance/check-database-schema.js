#!/usr/bin/env node

/**
 * Check Database Schema for Simple Campaigns
 * This script checks if the required columns exist in the campaigns table
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('🔍 Checking Database Schema...');
  console.log('Supabase URL:', supabaseUrl);
  console.log('');
  
  try {
    // Check if we can connect to the database
    console.log('📡 Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('campaigns')
      .select('count')
      .limit(0);
    
    if (testError) {
      console.error('❌ Database connection failed:', testError.message);
      return;
    }
    
    console.log('✅ Database connection successful');
    console.log('');
    
    // Try to check table structure by attempting to select the new columns
    console.log('🔍 Checking for simple campaign columns...');
    
    const requiredColumns = [
      'email_subject',
      'html_content', 
      'send_immediately',
      'scheduled_date',
      'timezone'
    ];
    
    const missingColumns = [];
    
    for (const column of requiredColumns) {
      try {
        const { error } = await supabase
          .from('campaigns')
          .select(column)
          .limit(0);
        
        if (error) {
          if (error.message.includes('column') && error.message.includes('does not exist')) {
            missingColumns.push(column);
            console.log(`❌ Missing column: ${column}`);
          } else {
            console.log(`⚠️  Error checking ${column}:`, error.message);
          }
        } else {
          console.log(`✅ Found column: ${column}`);
        }
      } catch (err) {
        console.log(`❌ Error checking ${column}:`, err.message);
        missingColumns.push(column);
      }
    }
    
    console.log('');
    
    if (missingColumns.length === 0) {
      console.log('🎉 All required columns found! Simple campaigns should work.');
    } else {
      console.log('🚨 MIGRATION REQUIRED');
      console.log(`Missing columns: ${missingColumns.join(', ')}`);
      console.log('');
      console.log('You need to run the database migration:');
      console.log('1. Open Supabase Dashboard → SQL Editor');
      console.log('2. Run the SQL from MANUAL_DATABASE_MIGRATION.md');
    }
    
    // Try to create a test record to see what fails
    console.log('');
    console.log('🧪 Testing campaign creation...');
    
    const testCampaignData = {
      name: 'Test Campaign - DELETE ME',
      email_subject: 'Test Subject',
      html_content: '<p>Test content</p>',
      send_immediately: true,
      status: 'draft'
    };
    
    const { data: testCampaign, error: createError } = await supabase
      .from('campaigns')
      .insert(testCampaignData)
      .select()
      .single();
    
    if (createError) {
      console.log('❌ Campaign creation test failed:');
      console.log('Error:', createError.message);
      console.log('Code:', createError.code);
      console.log('Details:', createError.details);
      console.log('Hint:', createError.hint);
    } else {
      console.log('✅ Campaign creation test successful!');
      console.log('Campaign ID:', testCampaign.id);
      
      // Clean up test record
      await supabase
        .from('campaigns')
        .delete()
        .eq('id', testCampaign.id);
      
      console.log('🧹 Test campaign cleaned up');
    }
    
  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
  }
}

checkSchema();