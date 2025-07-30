'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Settings, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Mail,
  TestTube,
  Info
} from 'lucide-react'

interface SMTPProvider {
  id: string
  name: string
  description: string
  smtp: {
    host: string
    port: number
    secure: boolean
  }
  authType: string
  setupInstructions: string[]
}

interface SMTPConfigDialogProps {
  onAccountCreated: () => void
}

export default function SMTPConfigDialog({ onAccountCreated }: SMTPConfigDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState<'provider' | 'config' | 'test' | 'complete'>('provider')
  const [providers, setProviders] = useState<SMTPProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<SMTPProvider | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  
  const [smtpConfig, setSMTPConfig] = useState({
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    name: '',
    testEmail: '',
  })

  useEffect(() => {
    if (isOpen) {
      fetchProviders()
    }
  }, [isOpen])

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/email-accounts/smtp-providers')
      if (response.ok) {
        const data = await response.json()
        setProviders(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching SMTP providers:', error)
    }
  }

  const handleProviderSelect = (provider: SMTPProvider) => {
    setSelectedProvider(provider)
    setSMTPConfig(prev => ({
      ...prev,
      host: provider.smtp.host,
      port: provider.smtp.port,
      secure: provider.smtp.secure,
      name: `${provider.name} Account`,
    }))
    setCurrentStep('config')
  }

  const handleCustomProvider = () => {
    setSelectedProvider({
      id: 'custom',
      name: 'Custom SMTP',
      description: 'Custom SMTP server configuration',
      smtp: { host: '', port: 587, secure: false },
      authType: 'password',
      setupInstructions: [
        'Get SMTP settings from your email provider',
        'Enter the SMTP host and port',
        'Choose the correct security setting',
        'Use your email credentials for authentication',
      ],
    })
    setSMTPConfig(prev => ({
      ...prev,
      host: '',
      port: 587,
      secure: false,
      name: 'Custom SMTP Account',
    }))
    setCurrentStep('config')
  }

  const handleTestConnection = async () => {
    setIsLoading(true)
    setError('')
    setTestResult(null)

    try {
      const response = await fetch('/api/email-accounts/test-smtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          username: smtpConfig.username,
          password: smtpConfig.password,
          testEmail: smtpConfig.testEmail || undefined,
        }),
      })

      const data = await response.json()
      setTestResult(data.data)

      if (data.success && data.data.connection.success) {
        setCurrentStep('test')
      } else {
        setError(data.data.connection.message || 'Connection test failed')
      }
    } catch (error) {
      setError('Failed to test SMTP connection')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateAccount = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/email-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'smtp',
          email: smtpConfig.username,
          name: smtpConfig.name,
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
        setCurrentStep('complete')
        onAccountCreated()
      } else {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create email account')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create account')
    } finally {
      setIsLoading(false)
    }
  }

  const resetDialog = () => {
    setCurrentStep('provider')
    setSelectedProvider(null)
    setSMTPConfig({
      host: '',
      port: 587,
      secure: false,
      username: '',
      password: '',
      name: '',
      testEmail: '',
    })
    setTestResult(null)
    setError('')
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetDialog()
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Configure SMTP
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>SMTP Configuration</DialogTitle>
          <DialogDescription>
            Connect your email account using SMTP settings
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {currentStep === 'provider' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Choose Email Provider</h3>
            
            <div className="grid gap-3 max-h-60 overflow-y-auto">
              {providers.map((provider) => (
                <Card
                  key={provider.id}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleProviderSelect(provider)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{provider.name}</h4>
                        <p className="text-sm text-gray-600">{provider.description}</p>
                        <div className="text-xs text-gray-500 mt-1">
                          {provider.smtp.host}:{provider.smtp.port} 
                          {provider.smtp.secure ? ' (SSL)' : ' (STARTTLS)'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <Card
                className="cursor-pointer hover:bg-gray-50 transition-colors border-dashed"
                onClick={handleCustomProvider}
              >
                <CardContent className="p-4">
                  <div className="text-center">
                    <h4 className="font-medium">Custom SMTP Server</h4>
                    <p className="text-sm text-gray-600">Configure your own SMTP settings</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {currentStep === 'config' && selectedProvider && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-medium">{selectedProvider.name} Configuration</h3>
            </div>

            {selectedProvider.setupInstructions.length > 0 && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center">
                    <Info className="h-4 w-4 mr-2" />
                    Setup Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {selectedProvider.setupInstructions.map((instruction, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-600 mr-2">{index + 1}.</span>
                        <span>{instruction}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Account Name</Label>
                <Input
                  id="name"
                  value={smtpConfig.name}
                  onChange={(e) => setSMTPConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Email Account"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="host">SMTP Host</Label>
                  <Input
                    id="host"
                    value={smtpConfig.host}
                    onChange={(e) => setSMTPConfig(prev => ({ ...prev, host: e.target.value }))}
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
                    onChange={(e) => setSMTPConfig(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                    placeholder="587"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={smtpConfig.secure}
                  onCheckedChange={(checked) => setSMTPConfig(prev => ({ ...prev, secure: checked }))}
                />
                <Label>Use SSL/TLS encryption</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username/Email</Label>
                <Input
                  id="username"
                  type="email"
                  value={smtpConfig.username}
                  onChange={(e) => setSMTPConfig(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password/App Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={smtpConfig.password}
                  onChange={(e) => setSMTPConfig(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Your password or app password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="testEmail">Test Email (Optional)</Label>
                <Input
                  id="testEmail"
                  type="email"
                  value={smtpConfig.testEmail}
                  onChange={(e) => setSMTPConfig(prev => ({ ...prev, testEmail: e.target.value }))}
                  placeholder="test@example.com"
                />
                <p className="text-xs text-gray-500">
                  We'll send a test email to verify the configuration
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => setCurrentStep('provider')}>
                Back
              </Button>
              <Button 
                onClick={handleTestConnection} 
                disabled={isLoading || !smtpConfig.host || !smtpConfig.username || !smtpConfig.password}
                className="flex-1"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'test' && testResult && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Connection Test Results</h3>
            
            <Card className={testResult.connection.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  {testResult.connection.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={testResult.connection.success ? 'text-green-800' : 'text-red-800'}>
                    {testResult.connection.message}
                  </span>
                </div>
                {testResult.connection.details && (
                  <div className="mt-2 text-sm text-gray-600">
                    <div>Host: {testResult.connection.details.host}</div>
                    <div>Port: {testResult.connection.details.port}</div>
                    <div>Security: {testResult.connection.details.secure ? 'SSL/TLS' : 'STARTTLS'}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {testResult.testEmail && (
              <Card className={testResult.testEmail.success ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    {testResult.testEmail.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                    )}
                    <span className={testResult.testEmail.success ? 'text-green-800' : 'text-yellow-800'}>
                      Test Email: {testResult.testEmail.message}
                    </span>
                  </div>
                  {testResult.testEmail.messageId && (
                    <div className="mt-1 text-xs text-gray-600">
                      Message ID: {testResult.testEmail.messageId}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => setCurrentStep('config')}>
                Back to Config
              </Button>
              <Button 
                onClick={handleCreateAccount} 
                disabled={isLoading || !testResult.connection.success}
                className="flex-1"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Create Account
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'complete' && (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">SMTP Account Created!</h3>
            <p className="text-gray-600 mb-6">
              Your SMTP email account has been successfully configured and is ready to use.
            </p>
            <Button onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}