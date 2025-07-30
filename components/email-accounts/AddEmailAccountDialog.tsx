'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus, Mail, ArrowRight, Loader2 } from 'lucide-react'
import { EMAIL_PROVIDERS, EmailProvider } from '@/lib/email-providers'
import SMTPConfigDialog from './SMTPConfigDialog'

interface AddEmailAccountDialogProps {
  onAccountAdded: () => void
}

export default function AddEmailAccountDialog({ onAccountAdded }: AddEmailAccountDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<EmailProvider | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [smtpConfig, setSmtpConfig] = useState({
    email: '',
    name: '',
    host: '',
    port: 587,
    username: '',
    password: '',
    secure: false,
  })

  const handleProviderSelect = (provider: EmailProvider) => {
    setSelectedProvider(provider)
  }

  const handleOAuthConnect = async (provider: EmailProvider) => {
    setIsLoading(true)
    try {
      // Redirect to OAuth flow
      window.location.href = provider.authUrl!
    } catch (error) {
      console.error('OAuth connection error:', error)
      setIsLoading(false)
    }
  }

  const handleSMTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/email-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'smtp',
          email: smtpConfig.email,
          name: smtpConfig.name || smtpConfig.email,
          smtp_config: {
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
            username: smtpConfig.username,
            password: smtpConfig.password,
          },
        }),
      })

      if (response.ok) {
        setIsOpen(false)
        setSelectedProvider(null)
        setSmtpConfig({
          email: '',
          name: '',
          host: '',
          port: 587,
          username: '',
          password: '',
          secure: false,
        })
        onAccountAdded()
      } else {
        const error = await response.json()
        throw new Error(error.message || 'Failed to add email account')
      }
    } catch (error) {
      console.error('SMTP setup error:', error)
      // Handle error (show toast, etc.)
    } finally {
      setIsLoading(false)
    }
  }

  const resetDialog = () => {
    setSelectedProvider(null)
    setSmtpConfig({
      email: '',
      name: '',
      host: '',
      port: 587,
      username: '',
      password: '',
      secure: false,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetDialog()
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Email Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Email Account</DialogTitle>
          <DialogDescription>
            Connect your email account to start sending cold emails
          </DialogDescription>
        </DialogHeader>

        {!selectedProvider ? (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Choose a provider</h3>
            <div className="grid gap-3">
              {EMAIL_PROVIDERS.map((provider) => (
                <Card
                  key={provider.id}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleProviderSelect(provider)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{provider.icon}</div>
                      <div className="flex-1">
                        <h4 className="font-medium">{provider.name}</h4>
                        <p className="text-sm text-gray-600">{provider.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : selectedProvider.type === 'oauth' ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">{selectedProvider.icon}</div>
              <div>
                <h3 className="font-medium">{selectedProvider.name}</h3>
                <p className="text-sm text-gray-600">{selectedProvider.description}</p>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">OAuth Connection</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    You'll be redirected to {selectedProvider.name} to authorize access to your email account.
                    We only request permissions to send emails on your behalf.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => setSelectedProvider(null)}>
                Back
              </Button>
              <Button 
                onClick={() => handleOAuthConnect(selectedProvider)}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Connect {selectedProvider.name}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSMTPSubmit} className="space-y-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="text-2xl">{selectedProvider.icon}</div>
              <div>
                <h3 className="font-medium">{selectedProvider.name}</h3>
                <p className="text-sm text-gray-600">{selectedProvider.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={smtpConfig.email}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, email: e.target.value })}
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={smtpConfig.name}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, name: e.target.value })}
                  placeholder="Your Name"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="host">SMTP Host</Label>
                <Input
                  id="host"
                  value={smtpConfig.host}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                  placeholder="smtp.gmail.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={smtpConfig.port}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value) })}
                  placeholder="587"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={smtpConfig.username}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })}
                  placeholder="Usually your email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={smtpConfig.password}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                  placeholder="App password recommended"
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="secure"
                checked={smtpConfig.secure}
                onCheckedChange={(checked) => setSmtpConfig({ ...smtpConfig, secure: checked })}
              />
              <Label htmlFor="secure">Use SSL/TLS encryption</Label>
            </div>

            <div className="flex space-x-3">
              <Button type="button" variant="outline" onClick={() => setSelectedProvider(null)}>
                Back
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Account
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}