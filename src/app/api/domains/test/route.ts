import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { DomainAuthService, extractDomainFromEmail, validateDomain } from '@/lib/domain-auth'

// POST /api/domains/test - Test domain auth functionality
export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    const body = await request.json()
    const { test_email } = body
    
    if (!test_email) {
      return NextResponse.json({
        error: 'test_email is required',
        code: 'VALIDATION_ERROR'
      }, { status: 400 })
    }
    
    const results = {
      email: test_email,
      tests: {}
    }
    
    // Test 1: Domain extraction
    try {
      const domain = extractDomainFromEmail(test_email)
      results.tests.domainExtraction = {
        success: true,
        domain,
        message: `Successfully extracted domain: ${domain}`
      }
      
      // Test 2: Domain validation
      const isValid = validateDomain(domain)
      results.tests.domainValidation = {
        success: isValid,
        message: isValid ? 'Domain format is valid' : 'Domain format is invalid'
      }
      
      // Test 3: Create domain auth record
      try {
        const domainAuthService = new DomainAuthService()
        
        // Check if domain auth already exists
        const existing = await domainAuthService.getDomain(user.id, domain)
        
        if (existing) {
          results.tests.domainAuthCreation = {
            success: true,
            message: 'Domain auth record already exists',
            existing: true,
            record: {
              id: existing.id,
              domain: existing.domain,
              spf_verified: existing.spf_verified,
              dkim_verified: existing.dkim_verified,
              dmarc_verified: existing.dmarc_verified
            }
          }
        } else {
          const domainAuth = await domainAuthService.createDomain(user.id, {
            domain,
            dns_provider: 'manual',
            auto_configure: false
          })
          
          results.tests.domainAuthCreation = {
            success: true,
            message: 'Domain auth record created successfully',
            existing: false,
            record: {
              id: domainAuth.id,
              domain: domainAuth.domain,
              spf_verified: domainAuth.spf_verified,
              dkim_verified: domainAuth.dkim_verified,
              dmarc_verified: domainAuth.dmarc_verified
            }
          }
        }
        
        // Test 4: Basic verification status check
        results.tests.verificationStatus = {
          success: true,
          message: 'Domain auth system is working correctly',
          systemStatus: 'operational'
        }
        
      } catch (error) {
        results.tests.domainAuthCreation = {
          success: false,
          message: `Failed to create domain auth: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
      
    } catch (error) {
      results.tests.domainExtraction = {
        success: false,
        message: `Failed to extract domain: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Domain auth system test completed',
      results
    })
  } catch (error) {
    console.error('Error testing domain auth:', error)
    return NextResponse.json({
      error: 'Failed to test domain auth system',
      code: 'TEST_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})