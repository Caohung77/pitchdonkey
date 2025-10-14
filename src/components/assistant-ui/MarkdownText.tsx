'use client'

import '@assistant-ui/react-markdown/styles/dot.css'

import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents
} from '@assistant-ui/react-markdown'
import { useState, memo, type FC } from 'react'
import remarkGfm from 'remark-gfm'
import { CheckIcon, CopyIcon } from 'lucide-react'

import { TooltipIconButton } from './TooltipIconButton'
import { cn } from '@/lib/utils'

const MarkdownTextImpl: FC = () => {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      className="aui-md"
      components={markdownComponents}
    />
  )
}

export const MarkdownText = memo(MarkdownTextImpl)

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard()

  return (
    <div className="mt-4 flex items-center justify-between gap-4 rounded-t-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
      <span className="lowercase [&>span]:text-xs">{language || 'code'}</span>
      <TooltipIconButton
        tooltip={isCopied ? 'Copied' : 'Copy'}
        variant="ghost"
        className="size-8 bg-transparent text-white hover:bg-slate-800"
        onClick={() => !isCopied && code && copyToClipboard(code)}
      >
        {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      </TooltipIconButton>
    </div>
  )
}

const useCopyToClipboard = (copiedDuration = 2000) => {
  const [isCopied, setIsCopied] = useState(false)

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), copiedDuration)
    })
  }

  return { isCopied, copyToClipboard }
}

const markdownComponents = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => (
    <h1 className={cn('mb-6 text-3xl font-bold tracking-tight', className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={cn('mb-5 mt-6 text-2xl font-semibold tracking-tight', className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn('mb-4 mt-6 text-xl font-semibold', className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn('mb-4 leading-7 text-muted-foreground', className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn('my-4 ml-5 list-disc space-y-1 text-muted-foreground', className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn('my-4 ml-5 list-decimal space-y-1 text-muted-foreground', className)}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a className={cn('text-primary underline underline-offset-2', className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote className={cn('border-l-2 pl-4 italic text-muted-foreground', className)} {...props} />
  ),
  table: ({ className, ...props }) => (
    <table className={cn('my-4 w-full overflow-hidden rounded-lg border', className)} {...props} />
  ),
  th: ({ className, ...props }) => (
    <th className={cn('bg-muted px-3 py-2 text-left text-sm font-semibold', className)} {...props} />
  ),
  td: ({ className, ...props }) => (
    <td className={cn('border-t px-3 py-2 text-sm text-muted-foreground', className)} {...props} />
  ),
  pre: ({ className, children }) => (
    <div className={cn('my-5 overflow-hidden rounded-lg border', className)}>
      {children}
    </div>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes('aui-md-code')
    if (isBlock) {
      const language = className?.replace(/language-/, '')
      const text = String(children ?? '')
      return (
        <div className="relative">
          <CodeHeader language={language} code={text} />
          <code className="block whitespace-pre-wrap bg-slate-950 px-4 py-4 text-sm leading-relaxed text-slate-100">
            {text}
          </code>
        </div>
      )
    }

    return (
      <code className={cn('rounded bg-muted px-1 py-[1px] text-xs', className)}>{children}</code>
    )
  },
  hr: ({ className, ...props }) => (
    <hr className={cn('my-6 border-t border-muted', className)} {...props} />
  )
})
