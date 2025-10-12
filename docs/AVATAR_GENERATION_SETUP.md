# Avatar Generation Setup Guide

## Overview

Generate professional headshots for AI personas using image generation APIs.

---

## Option 1: Google Vertex AI (Recommended)

Google's Imagen 3 provides the highest quality professional headshots.

### Setup Steps

1. **Create GCP Project**
   ```bash
   # Install gcloud CLI
   brew install google-cloud-sdk

   # Initialize
   gcloud init
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Enable APIs**
   ```bash
   # Enable Vertex AI API
   gcloud services enable aiplatform.googleapis.com

   # Enable Image Generation
   gcloud services enable generativelanguage.googleapis.com
   ```

3. **Create Service Account**
   ```bash
   gcloud iam service-accounts create imagen-service \
     --display-name="Imagen Service Account"

   # Grant permissions
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:imagen-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"

   # Create key
   gcloud iam service-accounts keys create imagen-key.json \
     --iam-account=imagen-service@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```

4. **Configure Environment**
   ```bash
   # .env.local
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/imagen-key.json
   GOOGLE_CLOUD_PROJECT=your-project-id
   GOOGLE_CLOUD_LOCATION=us-central1
   ```

5. **Update Code**
   ```typescript
   // lib/imagen-generator.ts
   import { VertexAI } from '@google-cloud/vertexai'

   const vertexAI = new VertexAI({
     project: process.env.GOOGLE_CLOUD_PROJECT!,
     location: process.env.GOOGLE_CLOUD_LOCATION!
   })
   ```

### Pricing
- $0.020 per image (512x512)
- $0.030 per image (1024x1024)
- First 100 images/month free

---

## Option 2: OpenAI DALL-E 3 (Simpler)

Easier to set up, good quality professional headshots.

### Setup Steps

1. **Get API Key**
   - Go to https://platform.openai.com/api-keys
   - Create new API key

2. **Configure Environment**
   ```bash
   # .env.local
   OPENAI_API_KEY=sk-...your-key-here
   ```

3. **Update Implementation**
   ```typescript
   // lib/imagen-generator.ts
   import OpenAI from 'openai'

   const openai = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY
   })

   export async function generatePersonaAvatar(
     personaName: string,
     personaType: string,
     options: AvatarGenerationOptions
   ): Promise<AvatarGenerationResult> {
     const prompt = buildAvatarPrompt(personaName, personaType, options)

     const response = await openai.images.generate({
       model: "dall-e-3",
       prompt: prompt,
       n: 1,
       size: "1024x1024",
       quality: "hd",
       style: "natural"
     })

     return {
       imageUrl: response.data[0].url!,
       prompt: prompt,
       metadata: {
         model: 'dall-e-3',
         quality: 'hd',
         revised_prompt: response.data[0].revised_prompt
       }
     }
   }
   ```

### Pricing
- $0.040 per image (standard quality)
- $0.080 per image (HD quality)

---

## Option 3: Replicate (Most Flexible)

Use various open-source models like Stable Diffusion, SDXL.

### Setup Steps

1. **Get API Token**
   - Go to https://replicate.com/account/api-tokens
   - Create new token

2. **Install Client**
   ```bash
   npm install replicate
   ```

3. **Configure Environment**
   ```bash
   # .env.local
   REPLICATE_API_TOKEN=r8_...your-token
   ```

4. **Update Implementation**
   ```typescript
   // lib/imagen-generator.ts
   import Replicate from 'replicate'

   const replicate = new Replicate({
     auth: process.env.REPLICATE_API_TOKEN
   })

   export async function generatePersonaAvatar(
     personaName: string,
     personaType: string,
     options: AvatarGenerationOptions
   ): Promise<AvatarGenerationResult> {
     const prompt = buildAvatarPrompt(personaName, personaType, options)

     const output = await replicate.run(
       "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
       {
         input: {
           prompt: prompt,
           negative_prompt: "cartoon, anime, illustration, painting, drawing, art, sketch",
           width: 1024,
           height: 1024,
           num_outputs: 1,
           scheduler: "DDIM",
           num_inference_steps: 50,
           guidance_scale: 7.5
         }
       }
     )

     return {
       imageUrl: output[0],
       prompt: prompt,
       metadata: {
         model: 'sdxl',
         negative_prompt: 'cartoon, anime...'
       }
     }
   }
   ```

### Pricing
- $0.0055 per image (SDXL)
- $0.0023 per image (Stable Diffusion)

---

## Option 4: Temporary - Use Placeholder Service

While setting up real API, use a placeholder service.

### Setup Steps

1. **Use UI Avatars Service (Free)**
   ```typescript
   // lib/imagen-generator.ts
   export async function generatePersonaAvatar(
     personaName: string,
     personaType: string,
     options: AvatarGenerationOptions
   ): Promise<AvatarGenerationResult> {
     const initials = personaName
       .split(' ')
       .map(n => n[0])
       .join('')
       .toUpperCase()

     const colors = {
       customer_support: 'EF4444',
       sales_rep: '3B82F6',
       sales_development: '10B981',
       account_manager: '8B5CF6',
       consultant: 'F59E0B',
       technical_specialist: '06B6D4',
       success_manager: 'EC4899',
       marketing_specialist: 'F97316'
     }

     const color = colors[personaType as keyof typeof colors] || '6B7280'

     const imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=512&background=${color}&color=fff&bold=true&format=png`

     return {
       imageUrl: imageUrl,
       prompt: `Generated initials avatar: ${initials}`,
       metadata: {
         type: 'placeholder',
         service: 'ui-avatars',
         initials: initials
       }
     }
   }
   ```

2. **Or Use Boring Avatars (Free, Better)**
   ```typescript
   const imageUrl = `https://source.boringavatars.com/beam/512/${encodeURIComponent(personaName)}?colors=264653,2a9d8f,e9c46a,f4a261,e76f51`
   ```

### Pricing
- Free
- No API key needed
- Good temporary solution

---

## Comparison

| Service | Quality | Setup | Cost | Speed |
|---------|---------|-------|------|-------|
| Google Vertex AI | ⭐⭐⭐⭐⭐ | Complex | $0.02-0.03 | Fast |
| OpenAI DALL-E 3 | ⭐⭐⭐⭐ | Easy | $0.04-0.08 | Fast |
| Replicate SDXL | ⭐⭐⭐⭐ | Medium | $0.006 | Medium |
| UI Avatars | ⭐⭐ | None | Free | Instant |

---

## Recommendation

1. **For Production**: OpenAI DALL-E 3
   - Best balance of quality, ease, and cost
   - Simple setup, reliable API
   - Natural-looking professional headshots

2. **For Testing**: UI Avatars or Boring Avatars
   - Get started immediately
   - No API keys needed
   - Upgrade later when ready

3. **For Scale**: Replicate
   - Most cost-effective at scale
   - Flexible model selection
   - Good quality at lowest price

---

## Quick Start (OpenAI)

1. **Install OpenAI SDK**
   ```bash
   npm install openai
   ```

2. **Add API Key**
   ```bash
   echo "OPENAI_API_KEY=sk-your-key-here" >> .env.local
   ```

3. **Update imagen-generator.ts**
   Replace the Google Gemini code with OpenAI DALL-E 3 code (shown above)

4. **Generate Avatars**
   ```bash
   npx tsx scripts/generate-sample-avatars.ts
   ```

5. **Verify in UI**
   - Go to `/dashboard/ai-personas`
   - See persona cards with generated avatars

---

## Troubleshooting

### Error: API Key Not Found
```
Solution: Check .env.local file exists and contains correct key
```

### Error: Rate Limited
```
Solution: Add delay between requests or upgrade API tier
```

### Error: Low Quality Images
```
Solution:
- Use "hd" quality for DALL-E
- Increase guidance_scale for Stable Diffusion
- Add more detail to prompts
```

### Error: Wrong Style (cartoon, anime)
```
Solution: Add negative prompt:
"cartoon, anime, illustration, painting, drawing, sketch"
```

---

**Recommendation**: Start with OpenAI DALL-E 3 for best results with minimal setup.
