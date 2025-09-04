import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { emailClassifier } from '@/lib/email-classifier'
import { imapProcessor } from '@/lib/imap-processor'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🔍 Starting email classification...')

    // Get first few unclassified emails for testing
    const { data: emails, error } = await supabase
      .from('incoming_emails')
      .select('*')
      .eq('classification_status', 'unclassified')
      .eq('processing_status', 'pending')
      .limit(10)

    if (error) {
      console.error('❌ Error fetching emails:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch emails'
      }, { status: 500 })
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unclassified emails found'
      })
    }

    console.log(`📊 Classifying ${emails.length} emails...`)

    const results = []

    for (const email of emails) {
      console.log(`\n🔍 Classifying: ${email.subject} (from ${email.from_address})`)
      
      try {
        // Convert to classifier format
        const incomingEmail = {
          id: email.id,
          messageId: email.message_id,
          inReplyTo: email.in_reply_to,
          emailReferences: email.email_references,
          fromAddress: email.from_address,
          toAddress: email.to_address,
          subject: email.subject,
          textContent: email.text_content,
          htmlContent: email.html_content,
          dateReceived: email.date_received
        }

        // Classify the email
        const classification = await emailClassifier.classifyEmail(incomingEmail)
        
        console.log(`📊 Result: ${classification.type} (${(classification.confidence * 100).toFixed(1)}% confidence)`)
        if (classification.sentiment) console.log(`😊 Sentiment: ${classification.sentiment}`)
        if (classification.intent) console.log(`🎯 Intent: ${classification.intent}`)
        
        // Update email classification in database
        await imapProcessor.updateEmailClassification(
          email.id,
          classification.type,
          classification.confidence
        )

        results.push({
          email: {
            id: email.id,
            from: email.from_address,
            subject: email.subject
          },
          classification: {
            type: classification.type,
            subtype: classification.subtype,
            confidence: classification.confidence,
            sentiment: classification.sentiment,
            intent: classification.intent,
            keywords: classification.keywords,
            requiresHumanReview: classification.requiresHumanReview
          }
        })

        console.log(`✅ Updated email ${email.id} with classification: ${classification.type}`)

      } catch (error) {
        console.error(`❌ Error classifying email ${email.id}:`, error)
        results.push({
          email: {
            id: email.id,
            from: email.from_address,
            subject: email.subject
          },
          error: error.message
        })
      }
    }

    // Get updated classification stats
    const { data: stats } = await supabase
      .from('incoming_emails')
      .select('classification_status, processing_status')

    const classificationStats = stats?.reduce((acc, email) => {
      acc[email.classification_status] = (acc[email.classification_status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    console.log('\n📊 Updated classification stats:', classificationStats)

    return NextResponse.json({
      success: true,
      message: `Classified ${results.length} emails`,
      results,
      updatedStats: classificationStats
    })

  } catch (error) {
    console.error('❌ Error classifying emails:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to classify emails' 
      },
      { status: 500 }
    )
  }
}