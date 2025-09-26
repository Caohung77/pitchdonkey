import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'

export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log('🔍 Diagnosing sent emails loading issue...')

    const diagnosis = {
      user_id: user.id,
      user_email: user.email,
      timestamp: new Date().toISOString(),
      issues: [] as string[],
      recommendations: [] as string[],
      table_info: null,
      query_tests: {}
    }

    // 1. Check if email_sends table exists and its structure
    console.log('📊 Checking email_sends table structure...')

    try {
      const { data: tableInfo, error: tableError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', 'email_sends')
        .eq('table_schema', 'public')
        .order('ordinal_position')

      if (tableError || !tableInfo || tableInfo.length === 0) {
        diagnosis.issues.push('email_sends table does not exist or is not accessible')
        diagnosis.recommendations.push('Create the email_sends table using the provided schema fix')
      } else {
        diagnosis.table_info = tableInfo
        console.log('✅ email_sends table found with structure:', tableInfo.map(c => `${c.column_name}: ${c.data_type}`))

        // Check for required columns
        const requiredColumns = ['id', 'user_id', 'subject', 'content', 'send_status', 'contact_id', 'email_account_id']
        const existingColumns = tableInfo.map(c => c.column_name)
        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col))

        if (missingColumns.length > 0) {
          diagnosis.issues.push(`Missing required columns: ${missingColumns.join(', ')}`)
          diagnosis.recommendations.push('Update table schema to include all required columns')
        }

        // Check data types
        const idColumn = tableInfo.find(c => c.column_name === 'id')
        if (idColumn && !idColumn.data_type.includes('uuid')) {
          diagnosis.issues.push(`ID column has wrong type: ${idColumn.data_type}, expected UUID`)
          diagnosis.recommendations.push('Convert ID columns to UUID type')
        }
      }
    } catch (error) {
      diagnosis.issues.push(`Error checking table structure: ${error}`)
    }

    // 2. Test the actual query that's failing in the API
    console.log('🧪 Testing API query...')

    try {
      const { data: apiTestData, error: apiTestError, count } = await supabase
        .from('email_sends')
        .select(`
          id,
          subject,
          content,
          send_status,
          sent_at,
          created_at,
          email_account_id,
          contact_id,
          campaign_id
        `, { count: 'exact' })
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false, nullsLast: false })
        .order('created_at', { ascending: false })
        .limit(5)

      if (apiTestError) {
        diagnosis.issues.push(`API query failed: ${apiTestError.message}`)
        diagnosis.query_tests.api_query = { success: false, error: apiTestError.message }
      } else {
        diagnosis.query_tests.api_query = { success: true, count, sample: apiTestData?.slice(0, 2) }
        console.log(`✅ API query successful! Found ${count} records`)
      }
    } catch (error) {
      diagnosis.issues.push(`Exception in API query: ${error}`)
      diagnosis.query_tests.api_query = { success: false, exception: String(error) }
    }

    // 3. Test joins with related tables
    console.log('🔗 Testing table relationships...')

    try {
      const { data: joinTestData, error: joinTestError } = await supabase
        .from('email_sends')
        .select(`
          id,
          subject,
          contacts (id, first_name, last_name, email),
          campaigns (id, name),
          email_accounts (id, email, provider)
        `)
        .eq('user_id', user.id)
        .limit(3)

      if (joinTestError) {
        diagnosis.issues.push(`Join query failed: ${joinTestError.message}`)
        diagnosis.query_tests.join_query = { success: false, error: joinTestError.message }
      } else {
        diagnosis.query_tests.join_query = { success: true, sample: joinTestData }
        console.log('✅ Join query successful')
      }
    } catch (error) {
      diagnosis.query_tests.join_query = { success: false, exception: String(error) }
    }

    // 4. Check related tables exist
    console.log('🔍 Checking related tables...')
    const relatedTables = ['contacts', 'campaigns', 'email_accounts', 'users']

    for (const tableName of relatedTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('id')
          .eq('user_id', user.id)
          .limit(1)

        diagnosis.query_tests[`${tableName}_table`] = {
          exists: !error,
          error: error?.message,
          has_user_data: !error && data && data.length > 0
        }
      } catch (error) {
        diagnosis.query_tests[`${tableName}_table`] = {
          exists: false,
          exception: String(error)
        }
      }
    }

    // 5. Generate final recommendations
    if (diagnosis.issues.length === 0) {
      diagnosis.recommendations.push('No structural issues found - check for data or permissions issues')
    } else {
      diagnosis.recommendations.push('Run the schema fix SQL file: fix-sent-emails-schema.sql')
      diagnosis.recommendations.push('Restart the application after schema changes')
    }

    const response = NextResponse.json({
      success: true,
      message: 'Diagnosis completed',
      diagnosis,
      summary: {
        total_issues: diagnosis.issues.length,
        critical_issues: diagnosis.issues.filter(issue =>
          issue.includes('does not exist') ||
          issue.includes('wrong type') ||
          issue.includes('API query failed')
        ).length,
        table_exists: diagnosis.table_info !== null,
        api_query_works: diagnosis.query_tests.api_query?.success === true
      }
    }, { status: 200 })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('🚨 Error in diagnosis:', error)
    return NextResponse.json({
      success: false,
      error: 'Diagnosis failed',
      details: String(error)
    }, { status: 500 })
  }
})