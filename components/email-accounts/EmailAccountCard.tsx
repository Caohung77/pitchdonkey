'use client'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  MoreHorizontal, 
  Settings, 
  TestTube, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Mail,
  Shield
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import DomainAuthDialog from './DomainAuthDialog'

interface EmailAccount {
  id: string
  provider: string
  email: string
  name: string
  is_verified: boolean
  is_active: boolean
  settings: {
    daily_limit: number
    delay_between_emails: number
    warm_up_enabled: boolean
  }
  created_at: string
}

interface EmailAccountCardProps {
  account: EmailAccount
  onEdit: (account: EmailAccount) => void
  onDelete: (accountId: string) => void
  onTest: (accountId: string) => void
  onVerify: (accountId: string) => void
}

export default function EmailAccountCard({
  account,
  onEdit,
  onDelete,
  onTest,
  onVerify,
}: EmailAccountCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isDomainAuthOpen, setIsDomainAuthOpen] = useState(false)

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'gmail':
        return '📧'
      case 'outlook':
        return '📮'
      case 'smtp':
        return '⚙️'
      default:
        return '📧'
    }
  }

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'gmail':
        return 'Gmail'
      case 'outlook':
        return 'Outlook'
      case 'smtp':
        return 'Custom SMTP'
      default:
        return provider
    }
  }

  const handleTest = async () => {
    setIsLoading(true)
    try {
      await onTest(account.id)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async () => {
    setIsLoading(true)
    try {
      await onVerify(account.id)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{getProviderIcon(account.provider)}</div>
            <div>
              <CardTitle className="text-lg">{account.name}</CardTitle>
              <CardDescription className="flex items-center space-x-2">
                <span>{account.email}</span>
                <span>•</span>
                <span>{getProviderName(account.provider)}</span>
              </CardDescription>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(account)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleTest} disabled={isLoading}>
                <TestTube className="h-4 w-4 mr-2" />
                Test Connection
              </DropdownMenuItem>
              {!account.is_verified && (
                <DropdownMenuItem onClick={handleVerify} disabled={isLoading}>
                  <Shield className="h-4 w-4 mr-2" />
                  Verify Account
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={() => onDelete(account.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status Badges */}
          <div className="flex items-center space-x-2">
            {account.is_verified ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unverified
              </Badge>
            )}
            {account.is_active ? (
              <Badge variant="default">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
            {account.settings.warm_up_enabled && (
              <Badge variant="outline">
                <Mail className="h-3 w-3 mr-1" />
                Warm-up
              </Badge>
            )}
          </div>

          {/* Settings Summary */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Daily Limit:</span>
              <div className="font-medium">{account.settings.daily_limit} emails</div>
            </div>
            <div>
              <span className="text-gray-500">Delay:</span>
              <div className="font-medium">{account.settings.delay_between_emails}s</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex space-x-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleTest}
              disabled={isLoading}
            >
              <TestTube className="h-4 w-4 mr-1" />
              Test
            </Button>
            {!account.is_verified && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleVerify}
                disabled={isLoading}
              >
                <Shield className="h-4 w-4 mr-1" />
                Verify
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsDomainAuthOpen(true)}
            >
              <Shield className="h-4 w-4 mr-1" />
              Domain Auth
            </Button>
          </div>
        </div>
      </CardContent>
      
      <DomainAuthDialog 
        domain={account.email.split('@')[1] || ''}
      />
    </Card>
  )
}