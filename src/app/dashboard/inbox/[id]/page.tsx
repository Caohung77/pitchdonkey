'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCw, Trash2, Reply, X, Send } from 'lucide-react'
import { EmailRichTextEditor } from '@/components/ui/EmailRichTextEditor'
import { Input } from '@/components/ui/input'

interface EmailAccount {
  id: string
  email: string
  provider: string
}

interface Email {
  id: string
  from_address: string
  to_address: string
  subject: string | null
  date_received: string
  text_content: string | null
  html_content: string | null
  email_accounts: EmailAccount
}

export default function EmailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<Email | null>(null)
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [replySubject, setReplySubject] = useState('')
  const [replyContent, setReplyContent] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetch(`/api/inbox/email/${params.id}`)
        const data = await resp.json()
        
        if (resp.ok) {
          setEmail(data.email)
        } else {
          console.error('Failed to load email:', data.error)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  const handleDeleteEmail = async () => {
    if (!email) return
    
    setDeleting(true)
    try {
      const response = await fetch('/api/inbox/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailIds: [email.id] })
      })

      if (response.ok) {
        router.push('/dashboard/inbox')
      } else {
        console.error('Failed to delete email')
      }
    } catch (error) {
      console.error('Error deleting email:', error)
    } finally {
      setDeleting(false)
    }
  }

  const handleReplyEmail = () => {
    if (!email) return
    
    const subject = email.subject || ''
    const replySubj = subject.startsWith('Re:') ? subject : `Re: ${subject}`
    setReplySubject(replySubj)
    
    // Clean and format the original email content
    const cleanContent = (content: string | null): string => {
      if (!content) return 'No content available'
      
      // Remove excessive line breaks and clean up the text
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, 10) // Limit to first 10 meaningful lines
        .join('\n')
    }
    
    const originalContent = email.text_content || email.html_content?.replace(/<[^>]*>/g, '') || 'No content available'
    const cleanedContent = cleanContent(originalContent)
    
    // Create a well-formatted quote with HTML structure
    const quote = `<div style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin: 20px 0; color: #6b7280;">
<p style="font-weight: 600; margin-bottom: 8px;">
On ${new Date(email.date_received).toLocaleDateString()} at ${new Date(email.date_received).toLocaleTimeString()}, ${email.from_address} wrote:
</p>
<div style="background: #f9fafb; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${cleanedContent}</div>
</div>`
    
    setReplyContent(quote)
    setIsReplyModalOpen(true)
  }

  const handleSendReply = async () => {
    if (!email || !replyContent.trim()) return
    
    setSending(true)
    try {
      const response = await fetch(`/api/email-accounts/${email.email_accounts.id}/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email.from_address,
          subject: replySubject,
          message: replyContent
        })
      })

      if (response.ok) {
        setIsReplyModalOpen(false)
        setReplyContent('')
        setReplySubject('')
        console.log('Reply sent successfully!')
      } else {
        console.error('Failed to send reply')
      }
    } catch (error) {
      console.error('Error sending reply:', error)
    } finally {
      setSending(false)
    }
  }

  const closeReplyModal = () => {
    setIsReplyModalOpen(false)
    setReplyContent('')
    setReplySubject('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!email) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900 mb-2">Email not found</p>
          <Button onClick={() => router.push('/dashboard/inbox')}>
            Back to Inbox
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/dashboard/inbox')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-gray-900 truncate">
                {email.subject || '(No Subject)'}
              </h1>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReplyEmail}
              className="flex items-center gap-2"
            >
              <Reply className="h-4 w-4" />
              Reply
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteEmail}
              disabled={deleting}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {deleting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Email Metadata */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="space-y-2 text-sm">
              <div className="flex">
                <span className="font-medium text-gray-700 w-16">From:</span>
                <span className="text-gray-900">{email.from_address}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-16">To:</span>
                <span className="text-gray-900">{email.to_address}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-16">Date:</span>
                <span className="text-gray-900">
                  {new Date(email.date_received).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          
          {/* Email Body */}
          <div className="prose max-w-none">
            {email.html_content ? (
              <div 
                className="email-content"
                dangerouslySetInnerHTML={{ __html: email.html_content }}
              />
            ) : (
              <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                {email.text_content || 'No content available'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reply Modal */}
      {isReplyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Reply to: {email.from_address}
              </h2>
              <Button variant="ghost" size="sm" onClick={closeReplyModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex-1 flex flex-col p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <Input
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  placeholder="Email subject..."
                  className="w-full"
                />
              </div>
              
              <div className="flex-1 mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <div className="border border-gray-300 rounded-lg overflow-hidden h-96">
                  <EmailRichTextEditor
                    value={replyContent}
                    onChange={setReplyContent}
                    placeholder="Write your reply..."
                    minHeight="300px"
                    hideVariables={true}
                    focusAtStart={true}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={closeReplyModal} disabled={sending}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSendReply}
                  disabled={sending || !replyContent.trim()}
                  className="flex items-center gap-2"
                >
                  {sending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sending ? 'Sending...' : 'Send Reply'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}