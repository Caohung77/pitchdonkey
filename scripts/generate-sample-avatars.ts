/**
 * Generate Headshots for Sample Personas
 *
 * This script generates professional headshots for the 3 sample personas:
 * - Sarah Chen (Customer Support - Female)
 * - Marcus Rodriguez (SDR - Male)
 * - Emma Thompson (Success Manager - Female)
 *
 * Run with: npx tsx scripts/generate-sample-avatars.ts
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/database.types'
import { generatePersonaAvatar } from '../lib/imagen-generator'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const samplePersonasConfig = [
  {
    name: 'Sarah Chen',
    personaType: 'customer_support' as const,
    options: {
      age: 'mid_career' as const,
      gender: 'female' as const,
      ethnicity: 'Asian',
      attire: 'business_casual' as const
    }
  },
  {
    name: 'Marcus Rodriguez',
    personaType: 'sales_development' as const,
    options: {
      age: 'young_adult' as const,
      gender: 'male' as const,
      ethnicity: 'Hispanic',
      attire: 'business_casual' as const
    }
  },
  {
    name: 'Emma Thompson',
    personaType: 'success_manager' as const,
    options: {
      age: 'mid_career' as const,
      gender: 'female' as const,
      ethnicity: 'Caucasian',
      attire: 'business_professional' as const
    }
  }
]

async function generateSampleAvatars() {
  console.log('🎨 Starting avatar generation for sample personas\n')

  try {
    for (const config of samplePersonasConfig) {
      console.log(`\n📸 Generating avatar for ${config.name}...`)

      // Find the persona
      const { data: persona, error: findError } = await supabase
        .from('ai_personas')
        .select('*')
        .eq('sender_name', config.name)
        .single()

      if (findError || !persona) {
        console.error(`   ❌ Persona not found: ${config.name}`)
        continue
      }

      // Check if avatar already exists
      if (persona.avatar_url && persona.avatar_generation_status === 'completed') {
        console.log(`   ⏭️  Avatar already exists, skipping`)
        continue
      }

      // Update status to generating
      await supabase
        .from('ai_personas')
        .update({ avatar_generation_status: 'generating' })
        .eq('id', persona.id)

      console.log(`   🔄 Generating avatar with Imagen 3...`)
      console.log(`      • Type: ${config.personaType}`)
      console.log(`      • Age: ${config.options.age}`)
      console.log(`      • Gender: ${config.options.gender}`)
      console.log(`      • Ethnicity: ${config.options.ethnicity}`)

      try {
        // Generate avatar
        const result = await generatePersonaAvatar(
          config.name,
          config.personaType,
          config.options
        )

        if (!result.success || !result.imageUrl) {
          throw new Error(result.error || 'Failed to generate image')
        }

        console.log(`   ✅ Avatar generated successfully!`)
        console.log(`      • Safety: ${result.metadata?.safetyRating}`)

        // Upload to Supabase Storage
        console.log(`   📤 Uploading to Supabase Storage...`)

        const { uploadAvatarToStorage } = await import('../lib/imagen-generator')
        const uploadResult = await uploadAvatarToStorage(
          result.imageUrl,
          persona.id,
          persona.user_id
        )

        if (!uploadResult) {
          throw new Error('Failed to upload to Supabase Storage')
        }

        console.log(`   ✅ Uploaded to Supabase Storage!`)
        console.log(`      • URL: ${uploadResult.url.substring(0, 60)}...`)

        // Update persona with avatar
        await supabase
          .from('ai_personas')
          .update({
            avatar_url: uploadResult.url,
            avatar_prompt: result.prompt,
            avatar_generation_status: 'completed',
            avatar_metadata: {
              ...result.metadata,
              storage_path: uploadResult.path
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', persona.id)

        console.log(`   ✅ Avatar saved to database!`)

      } catch (error: any) {
        console.error(`   ❌ Failed to generate avatar: ${error.message}`)

        // Update status to failed
        await supabase
          .from('ai_personas')
          .update({ avatar_generation_status: 'failed' })
          .eq('id', persona.id)
      }
    }

    console.log('\n\n🎉 Avatar generation complete!')
    console.log('\n📊 Summary:')

    // Show results
    const { data: updatedPersonas } = await supabase
      .from('ai_personas')
      .select('name, sender_name, avatar_generation_status, avatar_url')
      .in('sender_name', samplePersonasConfig.map(c => c.name))

    if (updatedPersonas) {
      updatedPersonas.forEach(p => {
        const status = p.avatar_generation_status === 'completed' ? '✅' :
                       p.avatar_generation_status === 'generating' ? '🔄' :
                       p.avatar_generation_status === 'failed' ? '❌' : '⏳'
        console.log(`   ${status} ${p.sender_name || p.name}: ${p.avatar_generation_status}`)
      })
    }

  } catch (error) {
    console.error('❌ Error generating avatars:', error)
    process.exit(1)
  }
}

// Run generation
generateSampleAvatars()
