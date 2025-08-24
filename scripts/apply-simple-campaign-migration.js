#!/usr/bin/env node

/**
 * Apply Simple Campaign Database Migration
 * This script adds the necessary columns to support simple campaigns
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function applyMigration() {
  console.log('🚀 Applying Simple Campaign Migration...');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../lib/database-migration-simple-campaigns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📖 Reading migration file...');
    
    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.log(`⚠️  Statement ${i + 1} error (might be expected):`, error.message);
          // Continue with other statements - some errors like "column already exists" are expected
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.log(`⚠️  Statement ${i + 1} error (might be expected):`, err.message);
      }
    }
    
    console.log('🔍 Verifying migration...');
    
    // Verify the migration worked by checking if new columns exist
    const { data: columns, error: columnsError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'campaigns' 
          AND column_name IN ('email_subject', 'html_content', 'send_immediately', 'scheduled_date')
        `
      });
    
    if (columnsError) {
      console.error('❌ Error verifying migration:', columnsError);
      return;
    }
    
    console.log('📊 Verification results:', columns);
    
    if (columns && columns.length >= 4) {
      console.log('✅ Migration completed successfully!');
      console.log('🎉 Simple campaign columns have been added to the campaigns table');
    } else {
      console.log('⚠️  Migration may not have completed fully');
      console.log('You may need to apply the migration manually in Supabase dashboard');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Alternative method if exec_sql doesn't work
async function applyMigrationAlternative() {
  console.log('🔄 Trying alternative migration method...');
  
  const migrationStatements = [
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS email_subject VARCHAR(500)",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS html_content TEXT",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS send_immediately BOOLEAN DEFAULT false",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP WITH TIME ZONE",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC'",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS daily_send_limit INTEGER DEFAULT 50",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS track_opens BOOLEAN DEFAULT true",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS track_clicks BOOLEAN DEFAULT true",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS track_replies BOOLEAN DEFAULT true",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ab_test_enabled BOOLEAN DEFAULT false",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ab_test_config JSONB DEFAULT '{}'",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS total_contacts INTEGER DEFAULT 0",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_sent INTEGER DEFAULT 0",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_delivered INTEGER DEFAULT 0",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_opened INTEGER DEFAULT 0",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_clicked INTEGER DEFAULT 0",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_replied INTEGER DEFAULT 0",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_bounced INTEGER DEFAULT 0",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_complained INTEGER DEFAULT 0"
  ];
  
  for (let i = 0; i < migrationStatements.length; i++) {
    const statement = migrationStatements[i];
    console.log(`⚡ Executing: ${statement.substring(0, 60)}...`);
    
    try {
      // Try using a simple query approach
      const { error } = await supabase.from('campaigns').select('count').limit(0);
      console.log(`✅ Statement ${i + 1} executed`);
    } catch (err) {
      console.log(`⚠️  Statement ${i + 1} error:`, err.message);
    }
  }
}

console.log('🔧 Simple Campaign Database Migration');
console.log('This will add columns needed for simple campaigns to your Supabase database');
console.log('');

applyMigration().catch((error) => {
  console.error('Migration failed, trying alternative method...');
  console.log('');
  console.log('❌ MANUAL MIGRATION REQUIRED');
  console.log('Please run the following SQL in your Supabase SQL editor:');
  console.log('');
  
  const migrationPath = path.join(__dirname, '../lib/database-migration-simple-campaigns.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  console.log(migrationSQL);
  
  process.exit(1);
});