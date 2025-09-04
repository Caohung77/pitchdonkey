import { NextRequest, NextResponse } from 'next/server'
import { emailClassifier, type IncomingEmail } from '@/lib/email-classifier'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing email classifier...')

    // Test emails for different classifications
    const testEmails: IncomingEmail[] = [
      {
        id: '1',
        messageId: 'bounce-test@example.com',
        fromAddress: 'mailer-daemon@gmail.com',
        toAddress: 'user@pitchdonkey.com',
        subject: 'Undelivered Mail Returned to Sender',
        textContent: 'The following message could not be delivered to one or more recipients. User unknown in local recipient table.',
        dateReceived: new Date().toISOString()
      },
      {
        id: '2', 
        messageId: 'auto-reply-test@example.com',
        fromAddress: 'john@company.com',
        toAddress: 'user@pitchdonkey.com',
        subject: 'Out of Office Auto Reply',
        textContent: 'I am currently out of office on vacation until next Monday. I will return on December 15th.',
        dateReceived: new Date().toISOString()
      },
      {
        id: '3',
        messageId: 'human-reply-test@example.com', 
        fromAddress: 'prospect@business.com',
        toAddress: 'user@pitchdonkey.com',
        subject: 'Re: Your proposal',
        textContent: 'Thanks for reaching out! I am very interested in learning more about your services. When can we schedule a call?',
        dateReceived: new Date().toISOString()
      },
      {
        id: '4',
        messageId: 'unsubscribe-test@example.com',
        fromAddress: 'angry@customer.com', 
        toAddress: 'user@pitchdonkey.com',
        subject: 'STOP EMAILING ME',
        textContent: 'Please unsubscribe me from your mailing list immediately. I do not want any more emails.',
        dateReceived: new Date().toISOString()
      }
    ]

    const results = []
    
    for (const email of testEmails) {
      console.log(`\n🔍 Classifying email from ${email.fromAddress}: ${email.subject}`)
      
      const classification = await emailClassifier.classifyEmail(email)
      
      console.log(`📊 Result: ${classification.type} (${(classification.confidence * 100).toFixed(1)}% confidence)`)
      if (classification.sentiment) console.log(`😊 Sentiment: ${classification.sentiment}`)
      if (classification.intent) console.log(`🎯 Intent: ${classification.intent}`)
      if (classification.keywords.length > 0) console.log(`🏷️  Keywords: ${classification.keywords.join(', ')}`)
      
      results.push({
        email: {
          from: email.fromAddress,
          subject: email.subject,
          preview: email.textContent?.substring(0, 100) + '...'
        },
        classification
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Email classifier testing completed',
      results
    })

  } catch (error) {
    console.error('❌ Error testing email classifier:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to test email classifier' 
      },
      { status: 500 }
    )
  }
}