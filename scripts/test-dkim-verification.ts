#!/usr/bin/env tsx
/**
 * Test DKIM verification directly
 */
import { DNSLookupService } from '@/lib/dns-lookup-service'
import { DomainVerificationEngine } from '@/lib/domain-verification-engine'

async function testDKIMVerification() {
  const domain = 'theaiwhisperer.de'
  const selector = 'coldreach202509eb0dde'

  console.log(`🧪 Testing DKIM verification for ${domain} with selector ${selector}`)
  console.log(`🔍 Looking up: ${selector}._domainkey.${domain}`)
  
  try {
    // Test DNS lookup directly
    console.log('\n--- DNS Lookup Test ---')
    const dnsResult = await DNSLookupService.lookupDKIM(domain, selector)
    console.log(`✅ DNS lookup successful:`)
    console.log(`   Response time: ${dnsResult.responseTime}ms`)
    console.log(`   Record found: ${!!dnsResult.record}`)
    if (dnsResult.record) {
      console.log(`   Key type: ${dnsResult.record.keyType}`)
      console.log(`   Version: ${dnsResult.record.version}`)
      console.log(`   Public key length: ${dnsResult.record.publicKey.length}`)
      console.log(`   Raw record: ${dnsResult.record.raw.substring(0, 100)}...`)
    }
    console.log(`   Raw DNS response: ${dnsResult.rawResponse.join(' | ')}`)

    // Test verification engine
    console.log('\n--- Verification Engine Test ---')
    const verificationResult = await DomainVerificationEngine.verifyDKIM(domain, selector)
    console.log(`✅ Verification result:`)
    console.log(`   Success: ${verificationResult.success}`)
    console.log(`   Valid: ${verificationResult.validation.isValid}`)
    console.log(`   Errors: ${verificationResult.validation.errors.join(', ') || 'None'}`)
    console.log(`   Warnings: ${verificationResult.validation.warnings.join(', ') || 'None'}`)
    console.log(`   Score: ${verificationResult.validation.score}`)
    console.log(`   Response time: ${verificationResult.responseTime}ms`)

  } catch (error) {
    console.error('❌ Test failed:', error)
    
    // Also test with the old selector to compare
    console.log('\n--- Testing old selector for comparison ---')
    try {
      const oldResult = await DNSLookupService.lookupDKIM(domain, 'coldreach2024')
      console.log(`Old selector result: ${!!oldResult.record ? 'Found' : 'Not found'}`)
    } catch (oldError) {
      console.log(`Old selector error: ${oldError instanceof Error ? oldError.message : 'Unknown error'}`)
    }
  }
}

testDKIMVerification()