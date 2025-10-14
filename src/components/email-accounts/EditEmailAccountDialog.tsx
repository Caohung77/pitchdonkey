'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Settings, AlertCircle, CheckCircle } from 'lucide-react'
import { ApiClient } from '@/lib/api-client'

interface EmailAccount {
  id: string
  provider: string
  email: string
  status: string
  domain: string
  daily_send_limit: number
  warmup_enabled: boolean
  smtp_host?: string
  smtp_port?: number
  smtp_username?: string
  smtp_password?: string
  smtp_secure?: boolean
  imap_host?: string
  imap_port?: number
  imap_enabled?: boolean
  imap_secure?: boolean
}

interface EditEmailAccountDialogProps {
  account: EmailAccount
  onAccountUpdated: () => void
}

export default function EditEmailAccountDialog({ account, onAccountUpdated }: EditEmailAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [formData, setFormData] = useState({
    daily_send_limit: account.daily_send_limit,
    warmup_enabled: account.warmup_enabled,
    smtp_host: account.smtp_host || '',
    smtp_port: account.smtp_port || 587,
    smtp_username: account.smtp_username || '',
    smtp_password: account.smtp_password || '',
    smtp_secure: account.smtp_secure ?? true,
    imap_enabled: account.imap_enabled ?? false,
    imap_host: account.imap_host || '',
    imap_port: account.imap_port || 993,
    imap_secure: account.imap_secure ?? true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const requestData: any = {
        settings: {
          daily_limit: formData.daily_send_limit,
          warm_up_enabled: formData.warmup_enabled,
        }
      }

      // Add SMTP config if this is an SMTP account
      if (account.provider === 'smtp') {
        requestData.smtp_config = {
          host: formData.smtp_host,
          port: formData.smtp_port,
          username: formData.smtp_username,
          password: formData.smtp_password,
          secure: formData.smtp_secure,
        }
      }

      // Add IMAP config if enabled
      if (formData.imap_enabled) {
        requestData.imap_config = {
          enabled: formData.imap_enabled,
          host: formData.imap_host,
          port: formData.imap_port,
          secure: formData.imap_secure,
        }
      }

      const response = await ApiClient.put(`/api/email-accounts/${account.id}`, requestData)

      setSuccess('Email account updated successfully!')
      onAccountUpdated()
      setTimeout(() => {
        setOpen(false)
        setSuccess('')
      }, 1500)
    } catch (error) {
      console.error('Error updating email account:', error)
      setError(error instanceof Error ? error.message : 'Failed to update email account')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Edit Email Account</DialogTitle>
          <DialogDescription>
            Update settings and credentials for {account.email}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex-shrink-0">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex-shrink-0">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-green-800 text-sm">{success}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="space-y-3 overflow-y-auto flex-1 pr-2">
          {/* General Settings */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">General Settings</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="daily_send_limit">Daily Send Limit</Label>
                <Input
                  id="daily_send_limit"
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.daily_send_limit}
                  onChange={(e) => handleInputChange('daily_send_limit', parseInt(e.target.value))}
                  required
                />
              </div>
              
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="warmup_enabled"
                  checked={formData.warmup_enabled}
                  onCheckedChange={(checked) => handleInputChange('warmup_enabled', checked)}
                />
                <Label htmlFor="warmup_enabled">Enable Warmup</Label>
              </div>
            </div>
          </div>

          {/* SMTP Settings (only for SMTP accounts) */}
          {account.provider === 'smtp' && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">SMTP Configuration</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtp_host">SMTP Host</Label>
                  <Input
                    id="smtp_host"
                    value={formData.smtp_host}
                    onChange={(e) => handleInputChange('smtp_host', e.target.value)}
                    placeholder="smtp.example.com"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="smtp_port">Port</Label>
                  <Input
                    id="smtp_port"
                    type="number"
                    value={formData.smtp_port}
                    onChange={(e) => handleInputChange('smtp_port', parseInt(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="smtp_username">Username</Label>
                <Input
                  id="smtp_username"
                  value={formData.smtp_username}
                  onChange={(e) => handleInputChange('smtp_username', e.target.value)}
                  placeholder="your-email@example.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="smtp_password">Password</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  value={formData.smtp_password}
                  onChange={(e) => handleInputChange('smtp_password', e.target.value)}
                  placeholder="Enter new password to update"
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="smtp_secure"
                  checked={formData.smtp_secure}
                  onCheckedChange={(checked) => handleInputChange('smtp_secure', checked)}
                />
                <Label htmlFor="smtp_secure">Use SSL/TLS</Label>
              </div>
            </div>
          )}

          {/* IMAP Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">IMAP Configuration (Email Receiving)</h4>
              <Switch
                id="imap_enabled"
                checked={formData.imap_enabled}
                onCheckedChange={(checked) => handleInputChange('imap_enabled', checked)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enable IMAP to automatically process incoming emails for bounces, replies, and unsubscribes.
            </p>
            
            {formData.imap_enabled && (
              <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="imap_host">IMAP Host</Label>
                    <Input
                      id="imap_host"
                      value={formData.imap_host}
                      onChange={(e) => handleInputChange('imap_host', e.target.value)}
                      placeholder={
                        account.provider === 'gmail' ? 'imap.gmail.com' :
                        account.provider === 'outlook' ? 'outlook.office365.com' :
                        'imap.example.com'
                      }
                      required={formData.imap_enabled}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="imap_port">IMAP Port</Label>
                    <Input
                      id="imap_port"
                      type="number"
                      value={formData.imap_port}
                      onChange={(e) => handleInputChange('imap_port', parseInt(e.target.value))}
                      required={formData.imap_enabled}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="imap_secure"
                    checked={formData.imap_secure}
                    onCheckedChange={(checked) => handleInputChange('imap_secure', checked)}
                  />
                  <Label htmlFor="imap_secure">Use SSL/TLS (recommended)</Label>
                </div>

                {/* Preset buttons for common providers */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      handleInputChange('imap_host', 'imap.gmail.com')
                      handleInputChange('imap_port', 993)
                      handleInputChange('imap_secure', true)
                    }}
                  >
                    Gmail Settings
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      handleInputChange('imap_host', 'outlook.office365.com')
                      handleInputChange('imap_port', 993)
                      handleInputChange('imap_secure', true)
                    }}
                  >
                    Outlook Settings
                  </Button>
                </div>
              </div>
            )}
          </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}