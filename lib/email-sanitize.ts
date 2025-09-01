// Simple HTML sanitizer for rendering email previews safely inside the app layout
// - Strips global/unsafe tags like <style>, <link>, <script>, <meta>, <head>, <html>, <body>, DOCTYPE
// - Returns inner content that won’t override app styles

export function sanitizeEmailHtml(html: string): string {
  if (!html) return ''

  let out = html

  try {
    // Remove doctype
    out = out.replace(/<!doctype[^>]*>/gi, '')
    // Remove html/head/body wrappers and meta tags
    out = out.replace(/<\/?html[^>]*>/gi, '')
    out = out.replace(/<\/?head[^>]*>/gi, '')
    out = out.replace(/<\/?body[^>]*>/gi, '')
    out = out.replace(/<meta[^>]*>/gi, '')
    // Remove style, link, and script tags that can leak/global override
    out = out.replace(/<style[\s\S]*?<\/style>/gi, '')
    out = out.replace(/<link[^>]*>/gi, '')
    out = out.replace(/<script[\s\S]*?<\/script>/gi, '')

    // Trim whitespace
    out = out.trim()
  } catch {
    // On any parsing error, fall back to original content
    return html
  }

  return out
}

