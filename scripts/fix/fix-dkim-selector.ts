#!/usr/bin/env tsx
/**
 * Fix DKIM selector for theaiwhisperer.de domain
 * This script updates the stored DKIM selector to match the actual DNS record
 */
import { createServerSupabaseClient } from '@/lib/supabase'

async function fixDKIMSelector() {
  const supabase = createServerSupabaseClient()
  const domain = 'theaiwhisperer.de'
  const correctSelector = 'coldreach202509eb0dde'

  try {
    console.log(`🔍 Looking up domain: ${domain}`)
    
    // Find the domain record
    const { data: domainAuth, error: fetchError } = await supabase
      .from('domain_auth')
      .select('*')
      .eq('domain', domain)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        console.log(`❌ Domain ${domain} not found in database`)
        return
      }
      throw fetchError
    }

    console.log(`📝 Found domain record:`)
    console.log(`   Current DKIM selector: ${domainAuth.dkim_selector}`)
    console.log(`   User ID: ${domainAuth.user_id}`)

    // Update the DKIM selector
    const { error: updateError } = await supabase
      .from('domain_auth')
      .update({
        dkim_selector: correctSelector,
        updated_at: new Date().toISOString()
      })
      .eq('id', domainAuth.id)

    if (updateError) {
      throw updateError
    }

    console.log(`✅ Successfully updated DKIM selector to: ${correctSelector}`)
    console.log(`🧪 Now try verifying the domain again - DKIM should pass!`)

  } catch (error) {
    console.error('❌ Error fixing DKIM selector:', error)
    process.exit(1)
  }
}

fixDKIMSelector()