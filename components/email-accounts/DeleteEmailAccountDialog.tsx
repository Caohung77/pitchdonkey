'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { ApiClient } from '@/lib/api-client'

interface DeleteEmailAccountDialogProps {
  account: {
    id: string
    email: string
    provider: string
    status?: string
  }
  onAccountDeleted: () => void
}

export default function DeleteEmailAccountDialog({ account, onAccountDeleted }: DeleteEmailAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      setError('')
      
      const response = await ApiClient.delete(`/api/email-accounts/${account.id}`)
      
      if (response.success) {
        // Close dialog and notify parent
        setOpen(false)
        onAccountDeleted()
        console.log('✅ Email account deleted successfully')
      } else {
        throw new Error(response.error || 'Failed to delete email account')
      }
      
    } catch (error: any) {
      console.error('Error deleting email account:', error)
      
      // Handle specific error cases
      if (error.message?.includes('NOT_FOUND')) {
        setError('Email account not found. It may have already been deleted.')
      } else if (error.message?.includes('RATE_LIMIT')) {
        setError('Too many requests. Please wait a moment before trying again.')
      } else if (error.message?.includes('CAMPAIGNS_ACTIVE') || error.message?.includes('active campaign')) {
        setError('Cannot delete this account because it has active campaigns. Please pause or stop all campaigns using this account first.')
      } else {
        setError(error.message || 'Failed to delete email account. Please try again.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Delete Email Account
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete the email account{' '}
              <span className="font-semibold">{account.email}</span>?
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mt-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">This action cannot be undone:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>The account will be permanently removed</li>
                    <li>Any active campaigns using this account will be paused</li>
                    <li>Email sending history will be preserved for reporting</li>
                    <li>You'll need to reconnect if you want to use this email again</li>
                    {account.status === 'active' && (
                      <li className="text-amber-700 font-medium">This account is currently active and may be sending emails</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          </div>
        )}
        
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="min-w-[120px]"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}