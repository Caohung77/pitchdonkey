# PDF Upload Feature - Implementation Guide

**Feature:** PDF Knowledge Upload in AI Persona Creation (Step 6)
**Version:** v0.24.0
**Status:** ✅ IMPLEMENTED
**Date:** 2025-10-13

---

## Overview

The PDF upload feature allows users to upload PDF files during AI Persona creation (Step 6 - Knowledge). PDFs are automatically uploaded to Supabase storage and content is extracted using Jina AI.

---

## User Flow

### Step-by-Step Process

1. **Navigate to Persona Creation**
   - Go to `/dashboard/ai-personas`
   - Click "Create New Persona"

2. **Complete Steps 1-5**
   - Fill in Basic Info, Persona Type, Personality, Appearance, and Context

3. **Step 6 - Knowledge Base**
   - Click "Add Knowledge"
   - Select "PDF" type from the three buttons (Text, URL, PDF)

4. **Upload PDF**
   - Click "Choose File" or drag PDF
   - File is validated:
     - ✅ Must be PDF format
     - ✅ Must be under 10MB
   - Auto-fills title from filename
   - Add optional description

5. **Add to Queue**
   - Click "Add Knowledge"
   - PDF appears in knowledge items list with:
     - 📄 PDF icon
     - File name
     - File size badge
   - Can add multiple PDFs before submitting

6. **Create Persona**
   - Click "Create Persona"
   - System automatically:
     1. Uploads PDF to Supabase storage
     2. Generates public URL
     3. Extracts content via Jina AI
     4. Saves knowledge item with extracted content

---

## Technical Implementation

### Frontend Components

**File:** `src/app/dashboard/ai-personas/create/page.tsx`

#### State Management
```typescript
const [knowledgeType, setKnowledgeType] = useState<'text' | 'link' | 'pdf'>('text')
const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null)
const [uploadingPdf, setUploadingPdf] = useState(false)
```

#### PDF File Selection
```typescript
const handlePdfFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0]
  if (!file) return

  // Validate file type
  if (file.type !== 'application/pdf') {
    toast.error('Please select a PDF file')
    return
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    toast.error('PDF file size must be less than 10MB')
    return
  }

  setSelectedPdfFile(file)
  // Auto-fill title from filename
  if (!knowledgeForm.title) {
    const fileName = file.name.replace(/\.pdf$/i, '')
    setKnowledgeForm(prev => ({ ...prev, title: fileName }))
  }
}
```

#### Upload and Extraction
```typescript
// During persona creation
if (item.type === 'pdf' && item.pdfFile) {
  // Step 1: Upload to Supabase storage
  const formData = new FormData()
  formData.append('file', item.pdfFile)

  const uploadResponse = await fetch(
    `/api/ai-personas/${personaId}/knowledge/upload-pdf`,
    { method: 'POST', body: formData }
  )

  const publicUrl = uploadResponse.data.publicUrl

  // Step 2: Extract content with Jina AI
  await ApiClient.post(`/api/ai-personas/${personaId}/knowledge/extract`, {
    type: 'pdf',
    url: publicUrl,
    title: item.title,
    description: item.description
  })
}
```

### Backend Endpoints

#### 1. Upload PDF
**Endpoint:** `POST /api/ai-personas/[personaId]/knowledge/upload-pdf`

**Request:**
```typescript
Content-Type: multipart/form-data
Body: { file: File }
```

**Response:**
```typescript
{
  success: true,
  data: {
    fileName: "document.pdf",
    fileSize: 245678,
    storagePath: "userId/personaId/timestamp_document.pdf",
    publicUrl: "https://supabase.storage.url/...",
    uploadedAt: "2025-10-13T10:00:00Z"
  }
}
```

**Storage Configuration:**
- Bucket: `persona-knowledge`
- Path: `{userId}/{personaId}/{timestamp}_{filename}`
- Public access: Yes (required for Jina AI)

#### 2. Extract Content
**Endpoint:** `POST /api/ai-personas/[personaId]/knowledge/extract`

**Request:**
```typescript
{
  type: "pdf",
  url: "https://supabase.storage.url/...",
  title: "Document Title",
  description: "Optional description"
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    knowledge: {
      id: "uuid",
      persona_id: "uuid",
      type: "pdf",
      title: "Document Title",
      content: "Extracted text content...",
      url: "https://supabase.storage.url/...",
      embedding_status: "ready"
    },
    extraction: {
      wordCount: 2500,
      extractedAt: "2025-10-13T10:00:30Z"
    }
  }
}
```

---

## UI Components

### Type Selection Buttons
```tsx
<div className="grid grid-cols-3 gap-2">
  <Button
    variant={knowledgeType === 'text' ? 'default' : 'outline'}
    onClick={() => setKnowledgeType('text')}
  >
    <Type className="h-4 w-4 mr-2" />
    Text
  </Button>
  <Button
    variant={knowledgeType === 'link' ? 'default' : 'outline'}
    onClick={() => setKnowledgeType('link')}
  >
    <Globe className="h-4 w-4 mr-2" />
    URL
  </Button>
  <Button
    variant={knowledgeType === 'pdf' ? 'default' : 'outline'}
    onClick={() => setKnowledgeType('pdf')}
  >
    <File className="h-4 w-4 mr-2" />
    PDF
  </Button>
</div>
```

### PDF Upload Input
```tsx
{knowledgeType === 'pdf' && (
  <div className="space-y-2">
    <Label htmlFor="knowledge_pdf">PDF File *</Label>
    <div className="flex items-center gap-3">
      <Input
        id="knowledge_pdf"
        type="file"
        accept=".pdf,application/pdf"
        onChange={handlePdfFileSelect}
        className="cursor-pointer"
      />
      {selectedPdfFile && (
        <Badge variant="secondary">
          {(selectedPdfFile.size / 1024).toFixed(1)} KB
        </Badge>
      )}
    </div>
    {selectedPdfFile && (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <File className="h-4 w-4" />
        <span>{selectedPdfFile.name}</span>
      </div>
    )}
    <p className="text-xs text-muted-foreground">
      Max file size: 10MB. Content extracted with Jina AI.
    </p>
  </div>
)}
```

### Knowledge Item Display
```tsx
{item.type === 'pdf' && (
  <>
    <File className="h-5 w-5 mt-0.5 text-primary" />
    <div className="flex items-center gap-2">
      <p className="font-medium">{item.title}</p>
      <Badge variant="secondary" className="text-xs">
        {(item.fileSize / 1024).toFixed(1)} KB
      </Badge>
    </div>
    <p className="text-sm text-muted-foreground">
      📄 {item.fileName}
    </p>
  </>
)}
```

---

## Testing Guide

### Manual Testing Checklist

#### ✅ Prerequisites
- [ ] Jina API key configured in `.env`
- [ ] Supabase storage bucket `persona-knowledge` exists
- [ ] Development server running (`npm run dev`)

#### ✅ Test Scenario 1: Valid PDF Upload
1. Navigate to persona creation
2. Complete steps 1-5
3. Go to Step 6 - Knowledge
4. Click "Add Knowledge"
5. Select "PDF" type
6. Upload a valid PDF (<10MB)
7. Verify:
   - ✅ File name shown
   - ✅ File size badge displayed
   - ✅ Title auto-filled from filename
8. Add description (optional)
9. Click "Add Knowledge"
10. Verify PDF appears in list with icon
11. Click "Create Persona"
12. Verify toast messages:
    - "Adding 1 knowledge items..."
    - "Uploading [filename]..."
    - "Extracting content from [filename]..."
    - "1 knowledge item added successfully"
    - "AI Persona created successfully!"

**Expected Result:** ✅ PDF uploaded, content extracted, persona created

#### ✅ Test Scenario 2: Invalid File Type
1. Try to upload a non-PDF file (.docx, .txt, .jpg)
2. Verify error: "Please select a PDF file"

**Expected Result:** ✅ Error shown, file rejected

#### ✅ Test Scenario 3: File Too Large
1. Try to upload PDF >10MB
2. Verify error: "PDF file size must be less than 10MB"

**Expected Result:** ✅ Error shown, file rejected

#### ✅ Test Scenario 4: Multiple Knowledge Items
1. Add a text knowledge item
2. Add a URL knowledge item
3. Add a PDF knowledge item
4. Verify all three appear in list
5. Create persona
6. Verify all three saved successfully

**Expected Result:** ✅ All items saved, PDF processed correctly

#### ✅ Test Scenario 5: Remove PDF Before Upload
1. Select PDF file
2. Click "Add Knowledge"
3. PDF appears in list
4. Click trash icon to remove
5. Verify PDF removed from list

**Expected Result:** ✅ PDF removed, not uploaded

---

## Error Handling

### Client-Side Validation
```typescript
// File type validation
if (file.type !== 'application/pdf') {
  toast.error('Please select a PDF file')
  return
}

// File size validation
const maxSize = 10 * 1024 * 1024 // 10MB
if (file.size > maxSize) {
  toast.error('PDF file size must be less than 10MB')
  return
}

// Title validation
if (!knowledgeForm.title.trim()) {
  toast.error('Please enter a title')
  return
}

// File selection validation
if (knowledgeType === 'pdf' && !selectedPdfFile) {
  toast.error('Please select a PDF file')
  return
}
```

### Server-Side Error Handling
```typescript
// Upload endpoint errors
- 400: No file provided
- 400: Only PDF files supported
- 400: File size exceeds 10MB
- 404: Persona not found
- 500: Upload failed

// Extraction endpoint errors
- 404: Persona not found
- 422: Invalid URL or extraction failed
- 500: Server error
```

### User-Facing Error Messages
- "Failed to upload PDF" → Check file and try again
- "Failed to extract content" → Jina AI error, contact support
- "File size exceeds 10MB limit" → Reduce file size
- "Please select a PDF file" → Wrong file type

---

## Performance Metrics

### Expected Performance
- **File Upload:** 1-5 seconds (depends on file size)
- **Content Extraction:** 30-60 seconds (Jina AI processing)
- **Total Time:** 35-65 seconds for complete workflow

### Optimization Tips
1. **Compress PDFs** before upload (use PDF compression tools)
2. **Batch uploads** - upload multiple PDFs in one session
3. **Progress feedback** - toast messages keep user informed
4. **Async processing** - extraction happens in background

---

## Troubleshooting

### Issue: PDF upload fails
**Possible Causes:**
- Network timeout
- Supabase storage not configured
- File corrupted

**Solution:**
1. Check network connection
2. Verify Supabase bucket exists
3. Try different PDF file

### Issue: Content extraction fails
**Possible Causes:**
- Jina API key invalid
- PDF URL not accessible
- PDF is scanned image (OCR required)

**Solution:**
1. Verify `JINA_API_KEY` in `.env`
2. Check PDF is publicly accessible
3. Use text-based PDFs (not scanned)

### Issue: Extraction takes too long
**Possible Causes:**
- Large PDF file
- Jina AI rate limiting
- Network latency

**Solution:**
1. Use smaller PDFs (<5MB recommended)
2. Wait for timeout (60 seconds)
3. Check Jina AI status page

---

## Configuration

### Environment Variables
```bash
# Required
JINA_API_KEY=jina_xxxxxxxxxxxxxxxx

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Supabase Storage Setup
```sql
-- Create bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('persona-knowledge', 'persona-knowledge', true);

-- Set bucket policies
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'persona-knowledge');

CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'persona-knowledge');
```

---

## Future Enhancements

### Planned Improvements
1. **Drag & Drop Upload** - Drag PDF files directly to upload area
2. **Multiple File Upload** - Upload multiple PDFs at once
3. **Upload Progress Bar** - Show real-time upload progress
4. **PDF Preview** - Preview PDF before upload
5. **Content Preview** - Show extracted content before saving
6. **Edit Extracted Content** - Allow editing of extracted text
7. **OCR Support** - Extract text from scanned PDFs
8. **Batch Extraction** - Process multiple PDFs simultaneously

### Technical Debt
- [ ] Add retry logic for failed uploads
- [ ] Implement upload cancellation
- [ ] Add file compression before upload
- [ ] Cache extraction results
- [ ] Add extraction quality scoring

---

## Code Examples

### Complete PDF Upload Flow
```typescript
// 1. User selects PDF file
<input type="file" accept=".pdf" onChange={handlePdfFileSelect} />

// 2. Validate and store file
const handlePdfFileSelect = (e) => {
  const file = e.target.files?.[0]
  if (file.type !== 'application/pdf') return
  if (file.size > 10 * 1024 * 1024) return
  setSelectedPdfFile(file)
}

// 3. Add to knowledge items
const handleAddKnowledge = () => {
  const newItem = {
    type: 'pdf',
    title: knowledgeForm.title,
    pdfFile: selectedPdfFile,
    fileName: selectedPdfFile.name,
    fileSize: selectedPdfFile.size
  }
  setFormData(prev => ({
    ...prev,
    knowledge_items: [...prev.knowledge_items, newItem]
  }))
}

// 4. Upload and extract during persona creation
const uploadAndExtract = async (item, personaId) => {
  // Upload
  const formData = new FormData()
  formData.append('file', item.pdfFile)
  const uploadRes = await fetch(`/api/ai-personas/${personaId}/knowledge/upload-pdf`, {
    method: 'POST',
    body: formData
  })
  const { data: { publicUrl } } = await uploadRes.json()

  // Extract
  await ApiClient.post(`/api/ai-personas/${personaId}/knowledge/extract`, {
    type: 'pdf',
    url: publicUrl,
    title: item.title,
    description: item.description
  })
}
```

---

## Support & Documentation

### Related Documentation
- **Main Testing Guide:** `docs/KNOWLEDGE_BASE_TESTING_GUIDE.md`
- **Test Summary:** `docs/KNOWLEDGE_BASE_TEST_SUMMARY.md`
- **Quick Start:** `docs/KNOWLEDGE_BASE_QUICK_START.md`
- **Jina AI Integration:** `lib/jina-extractor.ts`

### API Documentation
- Upload Endpoint: `src/app/api/ai-personas/[personaId]/knowledge/upload-pdf/route.ts`
- Extract Endpoint: `src/app/api/ai-personas/[personaId]/knowledge/extract/route.ts`

---

**Last Updated:** 2025-10-13
**Version:** 1.0.0
**Status:** ✅ Feature Complete
**Next Review:** After user testing feedback
