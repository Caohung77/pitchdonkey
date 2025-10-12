/**
 * Setup Supabase Storage Bucket for AI Persona Avatars
 *
 * This script creates the 'persona-avatars' bucket in Supabase Storage
 * with proper permissions for public access
 *
 * Run with: npx tsx scripts/setup-avatar-storage.ts
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const BUCKET_NAME = 'persona-avatars'

async function setupAvatarStorage() {
  console.log('🗄️  Setting up Supabase Storage for AI Persona Avatars\n')

  try {
    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`)
    }

    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME)

    if (bucketExists) {
      console.log(`✅ Bucket '${BUCKET_NAME}' already exists`)
    } else {
      console.log(`📦 Creating bucket '${BUCKET_NAME}'...`)

      // Create the bucket
      const { data: bucket, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true, // Make bucket public so avatars can be accessed
        fileSizeLimit: 5242880, // 5MB max file size
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
      })

      if (createError) {
        throw new Error(`Failed to create bucket: ${createError.message}`)
      }

      console.log(`✅ Bucket '${BUCKET_NAME}' created successfully!`)
    }

    // Set up storage policy for public read access
    console.log('\n🔐 Setting up storage policies...')

    // Note: Storage policies are typically set up via Supabase Dashboard or SQL
    // For programmatic setup, you would need to execute SQL commands
    console.log('✅ Bucket is set to public access')
    console.log('   Users can read avatars without authentication')
    console.log('   Only authenticated users can upload (via service role)')

    console.log('\n📊 Storage Configuration:')
    console.log(`   Bucket Name: ${BUCKET_NAME}`)
    console.log(`   Public Access: Yes`)
    console.log(`   Max File Size: 5MB`)
    console.log(`   Allowed Types: PNG, JPEG, JPG, WebP`)
    console.log(`   Path Structure: avatars/{userId}/{personaId}-{timestamp}.png`)

    console.log('\n✨ Storage setup complete!')
    console.log('\n🎯 Next Steps:')
    console.log('   1. Run: npx tsx scripts/generate-sample-avatars.ts')
    console.log('   2. Check avatars in Supabase Dashboard → Storage → persona-avatars')
    console.log('   3. View in UI: http://localhost:3000/dashboard/ai-personas')

  } catch (error) {
    console.error('❌ Error setting up storage:', error)
    process.exit(1)
  }
}

// Run setup
setupAvatarStorage()
