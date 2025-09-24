/**
 * Manual Campaign Trigger Script
 * Run this in your browser console on the pitchdonkey.vercel.app dashboard
 */

async function triggerTodaysEmails() {
  console.log('🚀 Starting manual email trigger...')

  try {
    // Step 1: Fix stuck campaigns
    console.log('1️⃣ Fixing stuck campaigns...')
    const fixResponse = await fetch('/api/campaigns/fix-stuck-campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    const fixResult = await fixResponse.json()
    console.log('✅ Fix result:', fixResult)

    if (!fixResponse.ok) {
      throw new Error(`Fix failed: ${fixResult.error || 'Unknown error'}`)
    }

    // Step 2: Trigger campaign processor
    console.log('2️⃣ Triggering campaign processor...')
    const processResponse = await fetch('/api/campaigns/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    const processResult = await processResponse.json()
    console.log('✅ Process result:', processResult)

    if (!processResponse.ok) {
      throw new Error(`Process failed: ${processResult.error || 'Unknown error'}`)
    }

    // Step 3: Check processor status
    console.log('3️⃣ Checking processor status...')
    const statusResponse = await fetch('/api/campaigns/processor')
    const statusResult = await statusResponse.json()
    console.log('📊 Status result:', statusResult)

    // Step 4: Force campaigns to sending status if needed
    console.log('4️⃣ Force updating campaign status...')

    // This is a workaround to force campaigns back to sending
    // We'll update campaigns that have remaining emails to send
    const updateResponse = await fetch('/api/campaigns/fix-stuck-campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    const updateResult = await updateResponse.json()
    console.log('🔧 Update result:', updateResult)

    // Final summary
    console.log(`
    🎉 MANUAL TRIGGER COMPLETED!

    Results:
    - Stuck campaigns fixed: ${fixResult.campaigns_fixed || 0}
    - Campaigns processed: ${processResult.success ? 'Success' : 'Failed'}
    - Active campaigns: ${statusResult.data?.activeCampaigns || 'Unknown'}

    Next steps:
    1. Wait 2-3 minutes for processing
    2. Refresh your dashboard
    3. Check campaign analytics
    4. If still not sending, run this script again
    `)

    // Show user-friendly alert
    alert(`✅ Email trigger completed!\n\nFixed: ${fixResult.campaigns_fixed || 0} campaigns\nStatus: ${processResult.success ? 'Processing started' : 'Check console for errors'}\n\nRefresh the page in 2-3 minutes to see results.`)

    return {
      success: true,
      fixed_campaigns: fixResult.campaigns_fixed || 0,
      processor_triggered: processResult.success,
      active_campaigns: statusResult.data?.activeCampaigns || 0
    }

  } catch (error) {
    console.error('❌ Error triggering emails:', error)
    alert(`❌ Error occurred: ${error.message}\n\nCheck the browser console for details.`)
    return { success: false, error: error.message }
  }
}

// Auto-run or provide instructions
if (window.location.hostname === 'pitchdonkey.vercel.app') {
  console.log(`
  🎯 READY TO TRIGGER TODAY'S EMAILS!

  To trigger your emails manually, run:
  triggerTodaysEmails()

  Or just wait - I'll run it automatically in 3 seconds...
  `)

  setTimeout(() => {
    console.log('🚀 Auto-triggering in 3... 2... 1...')
    triggerTodaysEmails()
  }, 3000)

} else {
  console.log(`
  ⚠️ Please navigate to https://pitchdonkey.vercel.app first!

  Then run this script in the console.
  `)
}

// Make function globally available
window.triggerTodaysEmails = triggerTodaysEmails