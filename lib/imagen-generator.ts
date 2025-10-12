/**
 * Imagen 3/4 Integration for AI Persona Avatar Generation
 * Uses Google's Gemini API with Imagen for professional headshot generation
 * Documentation: https://ai.google.dev/gemini-api/docs/imagen
 */

export interface AvatarGenerationOptions {
  personaName: string
  personaType: 'customer_support' | 'sales_rep' | 'sales_development' | 'account_manager' | 'consultant' | 'technical_specialist' | 'success_manager' | 'marketing_specialist' | 'custom'
  age?: 'young_adult' | 'mid_career' | 'senior' | 'executive'
  gender?: 'male' | 'female' | 'non_binary'
  ethnicity?: string
  attire?: 'business_formal' | 'business_casual' | 'smart_casual' | 'casual'
  personality?: {
    communication_style?: string
    formality?: string
    empathy_level?: string
  }
  customPrompt?: string
}

export interface AvatarGenerationResult {
  success: boolean
  imageUrl?: string
  imagePath?: string
  prompt: string
  error?: string
  metadata?: {
    model: string
    generatedAt: string
    options: AvatarGenerationOptions
    safetyRating?: string
  }
}

// Available Imagen models
const IMAGEN_MODELS = {
  IMAGEN_4_GENERATE: 'imagen-4.0-generate-001',
  IMAGEN_4_ULTRA: 'imagen-4.0-ultra-generate-001',
  IMAGEN_4_FAST: 'imagen-4.0-fast-generate-001',
  IMAGEN_3: 'imagen-3.0-generate-002'
}

// Default to Imagen 3 for better compatibility
const DEFAULT_MODEL = IMAGEN_MODELS.IMAGEN_3

/**
 * Build a professional headshot prompt for Imagen
 * Following best practices from Google Imagen documentation
 */
function buildAvatarPrompt(options: AvatarGenerationOptions): string {
  const {
    personaName,
    personaType,
    age = 'mid_career',
    gender,
    ethnicity,
    attire = 'business_casual',
    personality,
    customPrompt
  } = options

  // If custom prompt provided, use it
  if (customPrompt && customPrompt.trim()) {
    return `Professional headshot portrait: ${customPrompt.trim()}. White background, studio lighting, high quality, photorealistic.`
  }

  // Age descriptors
  const ageMap = {
    young_adult: '25-32 years old',
    mid_career: '33-45 years old',
    senior: '46-58 years old',
    executive: '50-65 years old'
  }

  // Persona type descriptors
  const personaDescriptors = {
    customer_support: 'warm, approachable, friendly demeanor',
    sales_rep: 'confident, engaging, professional presence',
    sales_development: 'energetic, outgoing, ambitious appearance',
    account_manager: 'reliable, polished, trustworthy look',
    consultant: 'authoritative, experienced, strategic presence',
    technical_specialist: 'intelligent, focused, competent demeanor',
    success_manager: 'supportive, professional, relationship-focused appearance',
    marketing_specialist: 'creative, dynamic, modern look',
    custom: 'professional, competent, approachable demeanor'
  }

  // Attire descriptions
  const attireMap = {
    business_formal: 'formal business suit, tie or professional dress',
    business_casual: 'business casual blazer or professional shirt',
    smart_casual: 'smart casual button-down or elegant top',
    casual: 'casual but professional attire'
  }

  // Build prompt matching the reference style:
  // - Clean white background
  // - Professional business casual attire (neutral colors)
  // - Warm, genuine smile
  // - Shoulders and upper body visible
  // - Centered composition
  // - Soft, even lighting
  // - Photorealistic corporate headshot quality

  const parts: string[] = []

  // Start with the exact style from reference
  parts.push('Professional corporate headshot portrait photograph,')
  parts.push(`${ageMap[age]} professional,`)

  if (gender) {
    parts.push(`${gender},`)
  }

  if (ethnicity) {
    parts.push(`${ethnicity} ethnicity,`)
  }

  // Expression matching reference image: warm, friendly, professional
  parts.push('warm genuine smile,')
  parts.push('friendly approachable expression,')
  parts.push('looking directly at camera,')

  // Attire - neutral business casual like reference
  if (attire === 'business_casual' || attire === 'smart_casual') {
    parts.push('wearing neutral colored business casual attire,')
    parts.push('light beige or cream colored top,')
  } else {
    parts.push(`wearing ${attireMap[attire]},`)
  }

  // Technical specifications matching reference image
  parts.push('pure white background,')
  parts.push('shoulders and upper body visible,')
  parts.push('centered composition,')
  parts.push('professional studio portrait lighting,')
  parts.push('soft even lighting with no harsh shadows,')
  parts.push('high key lighting setup,')
  parts.push('natural skin tones,')
  parts.push('sharp focus on face,')
  parts.push('professional corporate photography,')
  parts.push('clean professional aesthetic,')
  parts.push('photorealistic quality,')
  parts.push('8K resolution')

  return parts.join(' ')
}

/**
 * Generate a professional headshot using Google Imagen API
 */
export async function generatePersonaAvatar(
  personaName: string,
  personaType: AvatarGenerationOptions['personaType'],
  options: Partial<AvatarGenerationOptions> = {}
): Promise<AvatarGenerationResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY

  if (!apiKey) {
    console.error('❌ Google AI API key not configured')
    return {
      success: false,
      prompt: '',
      error: 'Google AI API key is not configured. Please add GOOGLE_GEMINI_API_KEY or GOOGLE_AI_API_KEY to environment variables. Get your key at: https://aistudio.google.com/apikey'
    }
  }

  try {
    const fullOptions: AvatarGenerationOptions = {
      personaName,
      personaType,
      ...options
    }

    const prompt = buildAvatarPrompt(fullOptions)
    console.log('🎨 Generating avatar with prompt:', prompt.substring(0, 100) + '...')

    // Use the Imagen API via REST
    // Documentation: https://ai.google.dev/gemini-api/docs/imagen
    const imageGenUrl = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:predict`

    const response = await fetch(imageGenUrl, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: prompt
          }
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1', // Square for profile photos
          personGeneration: 'allow_adult' // Allow professional adult portraits
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Imagen API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()

    // Extract the generated image from predictions
    if (!data.predictions || data.predictions.length === 0) {
      throw new Error('No images generated by Imagen API')
    }

    const prediction = data.predictions[0]

    // The API returns base64 encoded image data in bytesBase64Encoded
    const imageData = prediction.bytesBase64Encoded

    if (!imageData) {
      throw new Error('No image data in API response')
    }

    // Create data URL for the image
    const imageUrl = `data:image/png;base64,${imageData}`

    console.log('✅ Avatar generated successfully!')

    return {
      success: true,
      imageUrl: imageUrl,
      prompt: prompt,
      metadata: {
        model: DEFAULT_MODEL,
        generatedAt: new Date().toISOString(),
        options: fullOptions,
        safetyRating: prediction.safetyRating || 'not_provided'
      }
    }

  } catch (error) {
    console.error('❌ Avatar generation error:', error)
    return {
      success: false,
      prompt: buildAvatarPrompt({ personaName, personaType, ...options }),
      error: error instanceof Error ? error.message : 'Unknown error during avatar generation'
    }
  }
}

/**
 * Validate avatar generation options
 */
export function validateAvatarOptions(options: Partial<AvatarGenerationOptions>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!options.personaName || options.personaName.trim().length === 0) {
    errors.push('Persona name is required')
  }

  if (!options.personaType) {
    errors.push('Persona type is required')
  }

  const validPersonaTypes = [
    'customer_support', 'sales_rep', 'sales_development', 'account_manager',
    'consultant', 'technical_specialist', 'success_manager', 'marketing_specialist', 'custom'
  ]

  if (options.personaType && !validPersonaTypes.includes(options.personaType)) {
    errors.push(`Invalid persona type. Must be one of: ${validPersonaTypes.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Generate multiple avatar variations for the user to choose from
 */
export async function generateAvatarVariations(
  personaName: string,
  personaType: AvatarGenerationOptions['personaType'],
  options: Partial<AvatarGenerationOptions> = {},
  count: number = 3
): Promise<AvatarGenerationResult[]> {
  const results: AvatarGenerationResult[] = []

  for (let i = 0; i < count; i++) {
    const result = await generatePersonaAvatar(personaName, personaType, options)
    results.push(result)

    // Add a small delay between generations to avoid rate limiting
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  return results
}

/**
 * Get default avatar options based on persona type
 */
export function getDefaultAvatarOptions(personaType: AvatarGenerationOptions['personaType']): Partial<AvatarGenerationOptions> {
  const defaults: Record<string, Partial<AvatarGenerationOptions>> = {
    customer_support: {
      age: 'mid_career',
      attire: 'business_casual',
      personality: {
        communication_style: 'friendly',
        formality: 'professional',
        empathy_level: 'high'
      }
    },
    sales_rep: {
      age: 'mid_career',
      attire: 'business_formal',
      personality: {
        communication_style: 'confident',
        formality: 'professional',
        empathy_level: 'moderate'
      }
    },
    sales_development: {
      age: 'young_adult',
      attire: 'business_casual',
      personality: {
        communication_style: 'energetic',
        formality: 'casual',
        empathy_level: 'moderate'
      }
    },
    consultant: {
      age: 'senior',
      attire: 'business_formal',
      personality: {
        communication_style: 'authoritative',
        formality: 'formal',
        empathy_level: 'moderate'
      }
    }
  }

  return defaults[personaType] || {}
}

/**
 * Upload avatar to Supabase Storage
 * Converts base64 image to blob and uploads to Supabase
 */
export async function uploadAvatarToStorage(
  imageBase64: string,
  personaId: string,
  userId: string
): Promise<{ url: string; path: string } | null> {
  try {
    const { createClient } = await import('@supabase/supabase-js')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Convert base64 to buffer
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // Generate file path: avatars/{userId}/{personaId}-{timestamp}.png
    const timestamp = Date.now()
    const filePath = `avatars/${userId}/${personaId}-${timestamp}.png`

    console.log(`📤 Uploading avatar to Supabase Storage: ${filePath}`)

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('persona-avatars') // Bucket name
      .upload(filePath, buffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true
      })

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`)
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('persona-avatars')
      .getPublicUrl(filePath)

    console.log(`✅ Avatar uploaded successfully: ${publicUrlData.publicUrl}`)

    return {
      url: publicUrlData.publicUrl,
      path: filePath
    }

  } catch (error) {
    console.error('❌ Avatar upload error:', error)
    return null
  }
}
