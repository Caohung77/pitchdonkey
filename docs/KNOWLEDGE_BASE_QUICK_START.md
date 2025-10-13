# Knowledge Base Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Verify Configuration

```bash
# Check if Jina API key is configured
grep JINA_API_KEY .env

# Should show: JINA_API_KEY=jina_xxxxxxxxxx
```

### 2. Test Extraction

```bash
# Run quick test
node scripts/test-knowledge-extraction.js

# Expected: ✅ All tests passed successfully!
```

### 3. Use in UI

1. Go to `/dashboard/ai-personas`
2. Click "Create New Persona"
3. Fill steps 1-5
4. **Step 6 - Knowledge:**
   - Click "Add Knowledge"
   - Select "URL" type
   - Enter URL: `https://www.boniforce.de`
   - Click "Add Knowledge"
5. Complete persona creation

---

## 📋 Feature Overview

### What It Does
Extracts content from websites and PDFs to enhance AI persona knowledge.

### Supported Content Types
- ✅ **Text** - Direct text input
- ✅ **URL** - Website content extraction via Jina AI
- ✅ **PDF** - Document upload and extraction

### Key Benefits
- 🎯 More accurate AI responses
- 📚 Company-specific knowledge
- 🔄 Keep information up-to-date
- 🌐 Support for multiple languages

---

## 🎯 Common Use Cases

### Use Case 1: Company Website
```
Type: URL
Example: https://www.boniforce.de
Result: Extracts product info, services, company details
Use: AI responds with accurate company information
```

### Use Case 2: Product Documentation
```
Type: PDF
Example: product-specs.pdf
Result: Extracts technical specifications
Use: AI provides detailed product answers
```

### Use Case 3: FAQ Content
```
Type: Text
Example: Copy-paste FAQ content
Result: Stores FAQ text directly
Use: AI answers common questions accurately
```

---

## ⚡ Quick API Reference

### Extract from URL
```bash
POST /api/ai-personas/{personaId}/knowledge/extract
Content-Type: application/json

{
  "type": "url",
  "url": "https://example.com",
  "title": "Company Website"
}
```

### Upload PDF
```bash
POST /api/ai-personas/{personaId}/knowledge/upload-pdf
Content-Type: multipart/form-data

file: <PDF file>
```

### List Knowledge Items
```bash
GET /api/ai-personas/{personaId}/knowledge
```

---

## 🔧 Troubleshooting

### Issue: "JINA_API_KEY not configured"
**Fix:** Add to `.env` file:
```
JINA_API_KEY=your_key_here
```

### Issue: "Extraction failed"
**Check:**
1. URL is publicly accessible
2. Network connection is stable
3. Jina AI service is online

### Issue: "Content is empty"
**Possible causes:**
- Website requires JavaScript
- Content behind authentication
- Website blocks crawlers

**Solution:** Try different URL or use PDF instead

---

## 📊 Performance Tips

### Best Practices
1. **URLs:**
   - Use direct content pages (not homepages)
   - Avoid very large pages (>1MB)
   - Test URL before adding

2. **PDFs:**
   - Keep files under 10MB
   - Use text-based PDFs (not scanned images)
   - Ensure PDFs are not password-protected

3. **Content:**
   - Add multiple small items instead of one large item
   - Update knowledge regularly
   - Remove outdated information

### Expected Performance
- Simple URL: 2-5 seconds
- Complex URL: 5-15 seconds
- PDF: 30-60 seconds

---

## ✅ Testing Checklist

Before using in production:

- [ ] API key configured
- [ ] Test extraction script passes
- [ ] Test URL extraction in UI
- [ ] Test PDF upload (if using)
- [ ] Verify extracted content quality
- [ ] Test AI responses use knowledge

---

## 📞 Quick Help

### Test Extraction
```bash
node scripts/test-knowledge-extraction.js
```

### Check Logs
```bash
# Development
npm run dev

# Check console for:
# ✅ Extraction successful
# ❌ Extraction failed: [error]
```

### Useful Commands
```bash
# Build project
npm run build

# Run tests
npm test

# Check TypeScript
npm run type-check
```

---

## 🎓 Examples

### Example 1: Add Company Website
```typescript
// In UI or via API
{
  type: "link",
  title: "Boniforce Company Info",
  description: "Official company website",
  url: "https://www.boniforce.de"
}

// Result:
// ✅ 21,203 characters extracted
// ✅ 1,772 words
// ✅ Ready for AI use
```

### Example 2: Add Product Manual
```typescript
{
  type: "pdf",
  title: "Product Manual v2.0",
  description: "Complete product documentation",
  // Upload PDF file via form
}

// Result:
// ✅ PDF uploaded to Supabase
// ✅ Content extracted via Jina AI
// ✅ Saved to knowledge base
```

### Example 3: Add Custom Text
```typescript
{
  type: "text",
  title: "Sales Pitch",
  content: "We help companies with B2B credit checking...",
  description: "Standard sales pitch"
}

// Result:
// ✅ Text saved immediately
// ✅ No extraction needed
// ✅ Ready for AI use
```

---

## 🔗 Related Documentation

- **Full Testing Guide:** `docs/KNOWLEDGE_BASE_TESTING_GUIDE.md`
- **Test Summary:** `docs/KNOWLEDGE_BASE_TEST_SUMMARY.md`
- **Technical Docs:** `lib/jina-extractor.ts`
- **API Docs:** See CLAUDE.md

---

## 📈 Success Metrics

After adding knowledge:

✅ **Quality Indicators:**
- Content length: >500 characters
- Word count: >100 words
- Keywords present: ✅
- Extraction status: "ready"

✅ **AI Response Quality:**
- Accurate company info
- Specific product details
- No hallucinations
- Relevant answers

---

**Last Updated:** 2025-10-13
**Version:** 1.0.0
**Status:** Production Ready ✅
