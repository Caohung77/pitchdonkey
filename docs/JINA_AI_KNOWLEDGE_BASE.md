# Jina AI Knowledge Base Integration

## Overview

The AI Persona system now supports enhanced knowledge base management with automatic content extraction from multiple sources using Jina AI's Reader API. This allows users to add knowledge to their personas from:

1. **Text Input**: Direct text entry for custom content
2. **Website URLs**: Automatic content extraction from any public URL
3. **PDF Files**: Upload and extract content from PDF documents

## Architecture

### Components

#### 1. Jina AI Extraction Library (`lib/jina-extractor.ts`)
Core utility functions for content extraction:

- `extractFromUrl()` - Extract content from website URLs
- `extractFromPdf()` - Extract content from PDF files (via public URL)
- `extractMultipleUrls()` - Batch extraction for multiple URLs
- `validateUrl()` - URL validation before extraction
- `estimateExtractionTime()` - Estimate processing time

#### 2. API Endpoints

**`POST /api/ai-personas/[personaId]/knowledge/upload-pdf`**
- Uploads PDF files to Supabase storage
- Returns public URL for Jina AI processing
- Max file size: 10MB
- Storage path: `persona-knowledge/{userId}/{personaId}/{timestamp}_{filename}`

**`POST /api/ai-personas/[personaId]/knowledge/extract`**
- Extracts content from URLs or PDF files using Jina AI
- Automatically saves extracted content as knowledge item
- Updates persona knowledge summary

#### 3. UI Components
Enhanced knowledge base management in persona detail page:
- Three-tab interface: Text, URL, PDF
- Real-time extraction progress indicators
- File upload with drag-and-drop support
- Word count and metadata display

## Setup Instructions

### 1. Get Jina AI API Key

1. Visit [https://jina.ai](https://jina.ai) and create an account
2. Navigate to API settings
3. Generate a new API key for Reader API
4. Keep the key secure (starts with `jina_`)

### 2. Add Environment Variables

Add to `.env.local`:

```bash
JINA_API_KEY=jina_your_api_key_here
```

### 3. Configure Supabase Storage

Create a storage bucket for persona knowledge:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('persona-knowledge', 'persona-knowledge', true);

-- Set up storage policies
CREATE POLICY "Users can upload to their own persona knowledge"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'persona-knowledge' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read their own persona knowledge"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'persona-knowledge' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own persona knowledge"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'persona-knowledge' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## Usage Guide

### Adding Text Knowledge

```typescript
// Direct text entry - no extraction needed
const response = await ApiClient.post(`/api/ai-personas/${personaId}/knowledge`, {
  type: 'text',
  title: 'Product Features',
  description: 'Key features of our product',
  content: 'Our product includes...'
})
```

### Adding URL Knowledge

```typescript
// Automatic content extraction from URL
const response = await ApiClient.post(`/api/ai-personas/${personaId}/knowledge/extract`, {
  type: 'url',
  url: 'https://example.com/documentation',
  title: 'Product Documentation', // Optional
  description: 'Official product docs' // Optional
})

// Response includes extracted content and metadata
console.log(response.data.extraction.wordCount)
```

### Adding PDF Knowledge

```typescript
// Step 1: Upload PDF to storage
const formData = new FormData()
formData.append('file', pdfFile)

const uploadResponse = await fetch(`/api/ai-personas/${personaId}/knowledge/upload-pdf`, {
  method: 'POST',
  body: formData
})

const { publicUrl } = uploadResponse.data

// Step 2: Extract content from uploaded PDF
const extractResponse = await ApiClient.post(`/api/ai-personas/${personaId}/knowledge/extract`, {
  type: 'pdf',
  url: publicUrl,
  title: 'Product Manual',
  description: 'Technical documentation'
})
```

## Features

### URL Extraction
- **Automatic content extraction** from any public website
- **Markdown formatting** preservation
- **Metadata extraction**: title, description, word count
- **Error handling** with detailed error messages
- **Timeout protection** (30 seconds default)
- **Rate limiting** support for batch operations

### PDF Extraction
- **Secure file upload** to Supabase storage
- **Public URL generation** for Jina AI processing
- **Full text extraction** with formatting
- **Large file support** (up to 10MB)
- **Extended timeout** (60 seconds for PDFs)
- **Storage path organization** by user and persona

### Text Input
- **Direct entry** of custom content
- **No external dependencies** or API calls
- **Instant saving** to knowledge base
- **Rich text support** via markdown

## API Reference

### Jina AI Extraction Options

```typescript
interface JinaExtractionOptions {
  maxLength?: number      // Max content length (default: 50000)
  includeLinks?: boolean  // Include links (default: true)
  timeout?: number        // Request timeout in ms
}
```

### Extraction Result

```typescript
interface JinaExtractionResult {
  success: boolean
  content?: string        // Extracted markdown content
  title?: string          // Extracted or generated title
  description?: string    // Extracted description
  error?: string          // Error message if failed
  metadata?: {
    url: string
    wordCount: number
    extractedAt: string   // ISO timestamp
    source: 'url' | 'pdf'
  }
}
```

## Limitations

### Jina AI API
- **Rate limits**: Respect Jina AI's rate limiting (handled with batching)
- **URL accessibility**: Target URLs must be publicly accessible
- **PDF requirements**: PDFs must be accessible via public URL
- **Content length**: Recommended max 50K characters per extraction

### File Upload
- **Max PDF size**: 10MB per file
- **File type**: PDF only (validated on client and server)
- **Storage quota**: Depends on Supabase storage plan

### Performance
- **URL extraction**: ~5-10 seconds typical
- **PDF extraction**: ~10-30 seconds typical (depends on PDF size)
- **Concurrent extractions**: Limited to prevent rate limit issues

## Error Handling

### Common Errors

**URL Extraction Failures**:
- Invalid URL format
- URL not accessible (404, 403, etc.)
- Request timeout
- Rate limit exceeded

**PDF Processing Failures**:
- File too large (>10MB)
- Invalid PDF format
- Upload failure
- Extraction timeout

**API Key Issues**:
- Missing `JINA_API_KEY` environment variable
- Invalid or expired API key
- Insufficient API quota

### Error Messages

All errors include user-friendly messages and detailed error information for debugging:

```typescript
{
  success: false,
  error: 'Failed to extract content from URL',
  details: 'Request timeout - the URL took too long to fetch'
}
```

## Testing

### Manual Testing Checklist

1. **Text Knowledge**
   - [ ] Add text knowledge with title and content
   - [ ] Verify content saves correctly
   - [ ] Check knowledge appears in list

2. **URL Knowledge**
   - [ ] Add valid public URL
   - [ ] Verify extraction progress indicator
   - [ ] Check extracted content quality
   - [ ] Verify word count display
   - [ ] Test invalid URL handling

3. **PDF Knowledge**
   - [ ] Upload PDF file (<10MB)
   - [ ] Verify file upload progress
   - [ ] Check extraction progress
   - [ ] Verify extracted content
   - [ ] Test file size limit (>10MB)
   - [ ] Test invalid file type

4. **Error Scenarios**
   - [ ] Missing API key
   - [ ] Invalid URL format
   - [ ] Timeout scenarios
   - [ ] Network errors
   - [ ] Rate limit handling

## Best Practices

### Content Quality
- **Preview extracted content** before saving to knowledge base
- **Add descriptive titles** for better knowledge organization
- **Include relevant descriptions** for context
- **Verify extraction accuracy** especially for PDFs

### Performance
- **Batch URL extractions** when adding multiple URLs
- **Use appropriate timeouts** based on content size
- **Monitor API usage** to stay within Jina AI quotas
- **Cache frequently accessed URLs** to reduce API calls

### Security
- **Validate all URLs** before extraction
- **Sanitize file uploads** to prevent malicious files
- **Use environment variables** for API keys
- **Implement rate limiting** to prevent abuse
- **Restrict storage access** with RLS policies

## Troubleshooting

### Extraction Takes Too Long
- Check network connectivity
- Verify Jina AI service status
- Increase timeout if needed
- Try smaller content sources

### PDF Extraction Fails
- Verify PDF is valid and not corrupted
- Check file size (<10MB)
- Ensure PDF is text-based (not scanned images)
- Verify Supabase storage configuration

### API Key Issues
- Verify `JINA_API_KEY` in environment
- Check API key is valid on Jina AI dashboard
- Confirm API quota is not exceeded
- Restart server after adding key

## Future Enhancements

Potential improvements:
- Bulk URL import with CSV support
- Scheduled content refresh for URLs
- OCR support for scanned PDFs
- Custom extraction rules per URL
- Knowledge base search and filtering
- Automatic content summarization
- Multi-language content support
- Webhook-based async extraction

## Resources

- [Jina AI Documentation](https://docs.jina.ai)
- [Jina AI Reader API](https://docs.jina.ai/reader-api)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Next.js File Upload](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#formdata)
