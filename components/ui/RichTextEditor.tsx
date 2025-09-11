'use client'

import React, { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

export interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  onSave?: (html: string) => Promise<void>
  placeholder?: string
  className?: string
  minHeight?: string
  readOnly?: boolean
  autoSave?: boolean
  autoSaveDelay?: number
}

export function RichTextEditor({
  value,
  onChange,
  onSave,
  placeholder = 'Start typing your notes...',
  className = '',
  minHeight = '200px',
  readOnly = false,
  autoSave = true,
  autoSaveDelay = 2000,
}: RichTextEditorProps) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef<string>(value || '')
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
    ],
    editable: !readOnly,
    content: value || '',
    // Avoid SSR hydration mismatches in Next.js
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
      if (autoSave && onSave) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = setTimeout(async () => {
          try {
            if (html !== lastSavedRef.current) {
              await onSave(html)
              lastSavedRef.current = html
            }
          } catch (e) {
            // Non-blocking
            console.error('Notes auto-save failed:', e)
          }
        }, autoSaveDelay)
      }
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value && value !== current) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  return (
    <div className={className} aria-describedby="rte-desc">
      {/* Minimal toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 border border-gray-300 rounded-t-md px-2 py-1 bg-white">
          <button type="button" className="px-2 py-1 text-sm hover:bg-gray-100 rounded" onClick={() => editor?.chain().focus().toggleBold().run()} aria-label="Bold"><strong>B</strong></button>
          <button type="button" className="px-2 py-1 text-sm hover:bg-gray-100 rounded italic" onClick={() => editor?.chain().focus().toggleItalic().run()} aria-label="Italic">I</button>
          <button type="button" className="px-2 py-1 text-sm hover:bg-gray-100 rounded underline" onClick={() => editor?.chain().focus().toggleStrike().run()} aria-label="Strike">S</button>
          <span className="mx-1 w-px h-4 bg-gray-300" />
          <button type="button" className="px-2 py-1 text-sm hover:bg-gray-100 rounded" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} aria-label="H1">H1</button>
          <button type="button" className="px-2 py-1 text-sm hover:bg-gray-100 rounded" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="H2">H2</button>
          <button type="button" className="px-2 py-1 text-sm hover:bg-gray-100 rounded" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} aria-label="H3">H3</button>
          <span className="mx-1 w-px h-4 bg-gray-300" />
          <button type="button" className="px-2 py-1 text-sm hover:bg-gray-100 rounded" onClick={() => editor?.chain().focus().toggleBulletList().run()} aria-label="Bulleted list">• List</button>
          <button type="button" className="px-2 py-1 text-sm hover:bg-gray-100 rounded" onClick={() => editor?.chain().focus().toggleOrderedList().run()} aria-label="Ordered list">1. List</button>
          <span className="mx-1 w-px h-4 bg-gray-300" />
          <button type="button" className="px-2 py-1 text-sm hover:bg-gray-100 rounded" onClick={() => editor?.chain().focus().undo().run()} aria-label="Undo">Undo</button>
          <button type="button" className="px-2 py-1 text-sm hover:bg-gray-100 rounded" onClick={() => editor?.chain().focus().redo().run()} aria-label="Redo">Redo</button>
        </div>
      )}

      <div className={`border ${readOnly ? 'rounded-md' : 'rounded-b-md'} border-gray-300`} style={{ minHeight }}>
        <EditorContent editor={editor} className="prose prose-sm max-w-none p-3" />
      </div>

      <span id="rte-desc" className="sr-only">Rich text editor for contact notes with basic formatting</span>

      <style jsx global>{`
        .ProseMirror {
          min-height: ${minHeight};
          outline: none;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: '${placeholder.replace(/'/g, "\\'")}';
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}

export default RichTextEditor


