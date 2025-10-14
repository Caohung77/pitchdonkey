"use client"

import {
  ActionBarPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive
} from '@assistant-ui/react'
import { ArrowDownIcon, CopyIcon, PencilIcon, RefreshCwIcon, SendHorizontalIcon, SquareIcon } from 'lucide-react'
import type { FC, ReactNode } from 'react'

import { TooltipIconButton } from './TooltipIconButton'
import { MarkdownText } from './MarkdownText'
import { ToolFallback } from './ToolFallback'
import { cn } from '@/lib/utils'

type ThreadProps = {
  welcome?: ReactNode
  suggestions?: Array<{ prompt: string; label: string }>
}

export const Thread: FC<ThreadProps> = ({
  welcome = <p className="text-muted-foreground">How can I help you today?</p>,
  suggestions = []
}) => {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col bg-card text-card-foreground">
      <ThreadPrimitive.Viewport className="flex h-full flex-col items-center overflow-y-auto bg-muted/20 px-4 pt-6">
        <ThreadPrimitive.Empty>
          <div className="flex w-full max-w-3xl flex-1 flex-col items-center gap-4 text-center">
            {welcome}
            {suggestions.length > 0 ? (
              <div className="flex w-full flex-wrap items-center justify-center gap-3">
                {suggestions.map(suggestion => (
                  <ThreadPrimitive.Suggestion
                    key={suggestion.prompt}
                    prompt={suggestion.prompt}
                    method="replace"
                    autoSend
                    className="flex min-w-[180px] flex-1 items-center justify-center rounded-lg border bg-background px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted/70"
                  >
                    {suggestion.label}
                  </ThreadPrimitive.Suggestion>
                ))}
              </div>
            ) : null}
          </div>
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages
          components={{
            AssistantMessage,
            UserMessage,
            ErrorMessage,
            EditComposer
          }}
        />

        <ThreadPrimitive.If empty={false}>
          <div className="min-h-6 flex-1" />
        </ThreadPrimitive.If>

        <div className="sticky bottom-0 mt-4 flex w-full max-w-3xl flex-col items-center gap-3 rounded-t-2xl bg-card/95 pb-5">
          <ScrollToBottom />
          <Composer />
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  )
}

const ScrollToBottom: FC = () => (
  <ThreadPrimitive.ScrollToBottom asChild>
    <TooltipIconButton
      tooltip="Scroll to latest"
      variant="secondary"
      className="absolute -top-9 hidden size-8 items-center justify-center rounded-full shadow-sm aria-disabled:hidden lg:flex"
    >
      <ArrowDownIcon className="size-4" />
    </TooltipIconButton>
  </ThreadPrimitive.ScrollToBottom>
)

const Composer: FC = () => (
  <ComposerPrimitive.Root className="focus-within:ring-ring/40 flex w-full flex-wrap items-end gap-2 rounded-2xl border bg-background px-3 shadow-sm transition focus-within:ring">
    <ComposerPrimitive.Input
      rows={1}
      autoFocus
      placeholder="Write a message..."
      className="placeholder:text-muted-foreground flex-1 resize-none border-0 bg-transparent px-2 py-4 text-sm outline-none focus-visible:ring-0"
    />
    <ComposerAction />
  </ComposerPrimitive.Root>
)

const ComposerAction: FC = () => (
  <>
    <ThreadPrimitive.If running={false}>
      <ComposerPrimitive.Send asChild>
        <TooltipIconButton tooltip="Send" className="my-2 size-9 bg-primary text-primary-foreground">
          <SendHorizontalIcon className="size-4" />
        </TooltipIconButton>
      </ComposerPrimitive.Send>
    </ThreadPrimitive.If>
    <ThreadPrimitive.If running>
      <ComposerPrimitive.Cancel asChild>
        <TooltipIconButton
          tooltip="Cancel"
          className="my-2 size-9 bg-muted text-muted-foreground hover:bg-muted/80"
        >
          <SquareIcon className="size-4" />
        </TooltipIconButton>
      </ComposerPrimitive.Cancel>
    </ThreadPrimitive.If>
  </>
)

const UserMessage: FC = () => (
  <MessagePrimitive.Root className="grid w-full max-w-3xl auto-rows-auto grid-cols-[minmax(64px,1fr)_auto] gap-y-2 py-4 [&>*]:col-start-2">
    <UserActionBar />

    <div className="col-start-2 row-start-2 max-w-[80%] rounded-3xl bg-primary/10 px-5 py-2.5 text-sm text-primary-foreground">
      <MessagePrimitive.Parts />
    </div>
  </MessagePrimitive.Root>
)

const UserActionBar: FC = () => (
  <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" className="col-start-1 row-start-2 mr-3 mt-2 flex flex-col items-end">
    <ActionBarPrimitive.Edit asChild>
      <TooltipIconButton tooltip="Edit" className="size-8 bg-muted text-muted-foreground hover:bg-muted/80">
        <PencilIcon className="size-4" />
      </TooltipIconButton>
    </ActionBarPrimitive.Edit>
  </ActionBarPrimitive.Root>
)

const AssistantMessage: FC = () => (
  <MessagePrimitive.Root className="grid w-full max-w-3xl auto-rows-auto grid-cols-[auto_minmax(72px,1fr)] gap-y-3 py-4">
    <div className="col-span-full col-start-1 row-start-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
      <span>Assistant</span>
      <AssistantStatusIndicator />
    </div>

    <div className="col-start-1 row-start-2 max-w-[80%] rounded-3xl bg-background px-5 py-3 text-sm shadow-sm ring-1 ring-border/60">
      <MessagePrimitive.Parts
        components={{
          Text: MarkdownText,
          ToolResult: ({ part }) => (
            <ToolFallback title={part.toolName}>
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                {JSON.stringify(part.result, null, 2)}
              </pre>
            </ToolFallback>
          )
        }}
      />
    </div>

    <AssistantActionBar className="col-start-1 row-start-3 mt-1" />
  </MessagePrimitive.Root>
)

const AssistantStatusIndicator: FC = () => (
  <MessagePrimitive.If status="running">
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-500">
      <RefreshCwIcon className="size-3 animate-spin" /> Thinking
    </span>
  </MessagePrimitive.If>
)

const AssistantActionBar: FC<{ className?: string }> = ({ className }) => (
  <ActionBarPrimitive.Root className={cn('flex items-center gap-1', className)} hideWhenRunning>
    <ActionBarPrimitive.Copy asChild>
      <TooltipIconButton tooltip="Copy" className="size-8 bg-muted text-muted-foreground hover:bg-muted/80">
        <CopyIcon className="size-4" />
      </TooltipIconButton>
    </ActionBarPrimitive.Copy>
    <ActionBarPrimitive.Reload asChild>
      <TooltipIconButton tooltip="Regenerate" className="size-8 bg-muted text-muted-foreground hover:bg-muted/80">
        <RefreshCwIcon className="size-4" />
      </TooltipIconButton>
    </ActionBarPrimitive.Reload>
  </ActionBarPrimitive.Root>
)

const ErrorMessage: FC = () => (
  <ErrorPrimitive.Root className="w-full max-w-3xl rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
    <ErrorPrimitive.Message className="flex items-center gap-2 font-medium">
      <RefreshCwIcon className="size-4" />
      Something went wrong
    </ErrorPrimitive.Message>
  </ErrorPrimitive.Root>
)

const EditComposer: FC = () => (
  <ComposerPrimitive.Root className="bg-muted/70 my-4 flex w-full max-w-3xl flex-col gap-2 rounded-xl">
    <ComposerPrimitive.Input className="text-foreground flex w-full resize-none bg-transparent px-4 py-4 text-sm outline-none" />
    <div className="flex items-center justify-end gap-2 px-4 pb-3">
      <ComposerPrimitive.Cancel asChild>
        <Button variant="ghost" size="sm">
          Cancel
        </Button>
      </ComposerPrimitive.Cancel>
      <ComposerPrimitive.Send asChild>
        <Button size="sm">Update</Button>
      </ComposerPrimitive.Send>
    </div>
  </ComposerPrimitive.Root>
)
