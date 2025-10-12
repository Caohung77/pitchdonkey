/**
 * Migration Script: Outreach Agents → AI Personas
 *
 * This script:
 * 1. Migrates all existing outreach agents to enhanced AI personas format
 * 2. Adds default personality traits based on persona type
 * 3. Marks avatars as pending for generation
 * 4. Enables chat for all personas
 *
 * Run with: npx tsx scripts/migrate-to-ai-personas.ts
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/database.types'
import { DEFAULT_PERSONALITIES } from '../lib/persona-personality'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function migrateToAIPersonas() {
  console.log('🔄 Starting migration: Outreach Agents → AI Personas\n')

  try {
    // Fetch all personas (they're already in ai_personas table)
    const { data: personas, error: fetchError } = await supabase
      .from('ai_personas')
      .select('*')

    if (fetchError) {
      console.error('❌ Error fetching personas:', fetchError.message)
      process.exit(1)
    }

    if (!personas || personas.length === 0) {
      console.log('ℹ️  No personas found to migrate.')
      return
    }

    console.log(`📊 Found ${personas.length} personas to enhance\n`)

    let updated = 0
    let skipped = 0

    for (const persona of personas) {
      console.log(`\n📝 Processing: ${persona.name} (${persona.persona_type})`)

      // Check if already has personality traits
      if (persona.personality_traits && Object.keys(persona.personality_traits).length > 0) {
        console.log('   ⏭️  Already has personality traits, skipping')
        skipped++
        continue
      }

      // Get default personality for this persona type
      const defaultPersonality = DEFAULT_PERSONALITIES[persona.persona_type as keyof typeof DEFAULT_PERSONALITIES]

      if (!defaultPersonality) {
        console.log(`   ⚠️  No default personality for type: ${persona.persona_type}`)
        continue
      }

      // Prepare update payload
      const updates: any = {
        personality_traits: defaultPersonality.traits,
        chat_enabled: true,
        avatar_generation_status: 'pending',
        total_chats: persona.total_chats || 0,
        total_emails_handled: persona.total_emails_handled || 0,
        updated_at: new Date().toISOString()
      }

      // Add avatar prompt if not exists
      if (!persona.avatar_url && !persona.avatar_prompt) {
        updates.avatar_prompt = generateAvatarPrompt(
          persona.sender_name || persona.name,
          persona.persona_type
        )
      }

      // Update persona
      const { error: updateError } = await supabase
        .from('ai_personas')
        .update(updates)
        .eq('id', persona.id)

      if (updateError) {
        console.error(`   ❌ Failed to update: ${updateError.message}`)
        continue
      }

      console.log('   ✅ Enhanced successfully!')
      console.log(`      • Personality: ${defaultPersonality.traits.communication_style}`)
      console.log(`      • Empathy: ${defaultPersonality.traits.empathy_level}`)
      console.log(`      • Chat enabled: true`)
      console.log(`      • Avatar: pending generation`)
      updated++
    }

    console.log('\n\n📊 Migration Summary:')
    console.log(`   Total personas: ${personas.length}`)
    console.log(`   ✅ Enhanced: ${updated}`)
    console.log(`   ⏭️  Skipped: ${skipped}`)
    console.log('\n✨ Migration complete!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

function generateAvatarPrompt(name: string, personaType: string): string {
  const basePrompt = 'Professional corporate headshot, studio portrait lighting, clean white background, photorealistic'

  // Try to determine gender from name (basic heuristic)
  const femaleNames = ['sarah', 'emma', 'lisa', 'maria', 'anna', 'jennifer', 'emily']
  const isFemale = femaleNames.some(n => name.toLowerCase().includes(n))
  const gender = isFemale ? 'female' : 'male'
  const age = '30-40 years old'

  const personaStyles: Record<string, string> = {
    customer_support: 'warm genuine smile, empathetic appearance, wearing business casual',
    sales_rep: 'confident engaging smile, professional appearance, wearing business attire',
    sales_development: 'energetic confident smile, approachable look, wearing business casual',
    account_manager: 'warm professional smile, trustworthy appearance, wearing business professional',
    consultant: 'thoughtful intelligent look, expert presence, wearing professional attire',
    technical_specialist: 'focused competent look, technical expertise, wearing business casual',
    success_manager: 'supportive professional appearance, reliable look, wearing professional blazer',
    marketing_specialist: 'creative confident presence, strategic look, wearing modern business attire'
  }

  const style = personaStyles[personaType] || 'professional appearance, wearing business attire'

  return `${basePrompt}, ${age} ${gender} professional, ${style}`
}

// Run migration
migrateToAIPersonas()
