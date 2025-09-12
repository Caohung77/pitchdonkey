'use client'

import React, { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Bold, 
  Italic, 
  Underline, 
  Link, 
  List, 
  ListOrdered,
  AlignLeft,
  AlignCenter,
  Type,
  Undo,
  Redo,
  Eye,
  Code,
  Palette
} from 'lucide-react'

export interface EmailRichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  readOnly?: boolean
  showPreview?: boolean
  onPreviewToggle?: (show: boolean) => void
}

// Email-safe variables that can be inserted
const EMAIL_VARIABLES = {
  first_name: '{{first_name}}',
  last_name: '{{last_name}}',
  company: '{{company}}',
  company_name: '{{company_name}}',
  email: '{{email}}',
  website: '{{website}}',
  sender_name: '{{sender_name}}',
  personalised_reason: '((personalised_reason))'
}

export function EmailRichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing your email content...',
  className = '',
  minHeight = '300px',
  readOnly = false,
  showPreview = false,
  onPreviewToggle
}: EmailRichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { 
          levels: [1, 2, 3],
          // Generate email-safe headings with inline styles
          HTMLAttributes: {
            style: 'margin: 20px 0 10px 0; font-weight: bold; line-height: 1.3;'
          }
        },
        paragraph: {
          HTMLAttributes: {
            style: 'margin: 0 0 16px 0; line-height: 1.6;'
          }
        },
        bulletList: {
          HTMLAttributes: {
            style: 'margin: 16px 0; padding-left: 20px;'
          }
        },
        orderedList: {
          HTMLAttributes: {
            style: 'margin: 16px 0; padding-left: 20px;'
          }
        },
        listItem: {
          HTMLAttributes: {
            style: 'margin: 4px 0;'
          }
        },
        bold: {
          HTMLAttributes: {
            style: 'font-weight: bold;'
          }
        },
        italic: {
          HTMLAttributes: {
            style: 'font-style: italic;'
          }
        },
        link: {
          autolink: true,
          openOnClick: false, // Don't open links in editor
          HTMLAttributes: { 
            style: 'color: #007bff; text-decoration: underline;',
            rel: 'noopener noreferrer',
            target: '_blank' 
          },
        },
      }),
    ],
    editable: !readOnly,
    content: value || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // Generate clean HTML with email-safe inline styles
      const html = editor.getHTML()
      onChange(html)
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value && value !== current) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  const insertVariable = (variable: keyof typeof EMAIL_VARIABLES) => {
    if (!editor) return
    editor.chain().focus().insertContent(`${EMAIL_VARIABLES[variable]} `).run()
  }

  const applyEmailSafeFormatting = (command: () => void) => {
    command()
    // After applying formatting, we could add inline styles here if needed
    // The StarterKit configuration above handles most of this automatically
  }

  const insertEmailTemplate = (template: 'basic' | 'professional') => {
    if (!editor) return
    
    const templates = {
      basic: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Hello {{first_name}},</h1>
  
  <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
    I hope this email finds you well. I wanted to reach out because...
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
    [Your message content here]
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
    Best regards,<br>
    {{sender_name}}
  </p>
</div>
      `,
      professional: `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 30px;">
  <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <div style="border-left: 4px solid #007bff; padding-left: 20px; margin-bottom: 30px;">
      <h1 style="color: #2c3e50; font-size: 28px; margin: 0;">Hello {{first_name}},</h1>
    </div>
    
    <p style="color: #34495e; font-size: 16px; line-height: 1.8; margin-bottom: 20px;">
      I hope this message finds you well. I'm reaching out regarding...
    </p>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 25px 0; border-left: 4px solid #28a745;">
      <p style="color: #2c3e50; font-size: 16px; line-height: 1.6; margin: 0;">
        [Highlighted message or key point]
      </p>
    </div>
    
    <div style="border-top: 1px solid #e9ecef; padding-top: 25px; margin-top: 35px;">
      <p style="color: #6c757d; font-size: 14px; line-height: 1.6; margin: 0;">
        Best regards,<br>
        <strong>{{sender_name}}</strong><br>
        {{company_name}}
      </p>
    </div>
  </div>
</div>
      `
    }
    
    editor.chain().focus().clearContent().insertContent(templates[template].trim()).run()
  }

  if (!editor) {
    return <div className="animate-pulse bg-gray-100 h-64 rounded-md" />
  }

  return (
    <div className={`border border-gray-300 rounded-md overflow-hidden ${className}`}>
      {/* Enhanced Toolbar for Email */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 border-b border-gray-300 px-3 py-2 bg-gray-50">
          {/* Text Formatting */}
          <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyEmailSafeFormatting(() => editor.chain().focus().toggleBold().run())}
              className={editor.isActive('bold') ? 'bg-blue-100' : ''}
              aria-label="Bold"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyEmailSafeFormatting(() => editor.chain().focus().toggleItalic().run())}
              className={editor.isActive('italic') ? 'bg-blue-100' : ''}
              aria-label="Italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
          </div>

          {/* Headings */}
          <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={editor.isActive('heading', { level: 1 }) ? 'bg-blue-100' : ''}
              aria-label="Heading 1"
            >
              H1
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor.isActive('heading', { level: 2 }) ? 'bg-blue-100' : ''}
              aria-label="Heading 2"
            >
              H2
            </Button>
          </div>

          {/* Lists */}
          <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive('bulletList') ? 'bg-blue-100' : ''}
              aria-label="Bullet List"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={editor.isActive('orderedList') ? 'bg-blue-100' : ''}
              aria-label="Numbered List"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
          </div>

          {/* Link */}
          <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const url = window.prompt('Enter URL')?.trim()
                if (url === undefined) return
                if (!url) {
                  editor.chain().focus().unsetLink().run()
                  return
                }
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
              }}
              className={editor.isActive('link') ? 'bg-blue-100' : ''}
              aria-label="Add Link"
            >
              <Link className="h-4 w-4" />
            </Button>
          </div>

          {/* Undo/Redo */}
          <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              aria-label="Undo"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              aria-label="Redo"
            >
              <Redo className="h-4 w-4" />
            </Button>
          </div>

          {/* Templates */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertEmailTemplate('basic')}
              aria-label="Insert Basic Template"
              className="text-xs"
            >
              Basic
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertEmailTemplate('professional')}
              aria-label="Insert Professional Template"
              className="text-xs"
            >
              Professional
            </Button>
          </div>

          {/* Preview Toggle */}
          {onPreviewToggle && (
            <div className="ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onPreviewToggle(!showPreview)}
                className={showPreview ? 'bg-blue-100' : ''}
                aria-label="Toggle Preview"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Variable Insertion Bar */}
      {!readOnly && (
        <div className="px-3 py-2 bg-blue-50 border-b border-gray-300">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-blue-900">Variables:</span>
            {Object.entries(EMAIL_VARIABLES).map(([key, value]) => (
              <Badge
                key={key}
                variant="secondary"
                className="cursor-pointer hover:bg-blue-200 bg-blue-100 text-blue-800 text-xs"
                onClick={() => insertVariable(key as keyof typeof EMAIL_VARIABLES)}
                title={`Insert ${value}`}
              >
                {value}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div style={{ minHeight }}>
        <EditorContent 
          editor={editor} 
          className="prose prose-sm max-w-none p-4 focus:outline-none"
        />
      </div>

      <style jsx global>{`
        .ProseMirror {
          min-height: ${minHeight};
          outline: none;
          font-family: Arial, sans-serif;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: '${placeholder.replace(/'/g, "\\'")}';
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror h1 {
          font-size: 24px;
          font-weight: bold;
          margin: 20px 0 10px 0;
          line-height: 1.3;
          color: #333;
        }
        .ProseMirror h2 {
          font-size: 20px;
          font-weight: bold;
          margin: 18px 0 8px 0;
          line-height: 1.3;
          color: #333;
        }
        .ProseMirror h3 {
          font-size: 18px;
          font-weight: bold;
          margin: 16px 0 6px 0;
          line-height: 1.3;
          color: #333;
        }
        .ProseMirror p {
          margin: 0 0 16px 0;
          line-height: 1.6;
          color: #333;
        }
        .ProseMirror ul, .ProseMirror ol {
          margin: 16px 0;
          padding-left: 20px;
        }
        .ProseMirror li {
          margin: 4px 0;
        }
        .ProseMirror a {
          color: #007bff;
          text-decoration: underline;
        }
        .ProseMirror strong {
          font-weight: bold;
        }
        .ProseMirror em {
          font-style: italic;
        }
      `}</style>
    </div>
  )
}

export default EmailRichTextEditor