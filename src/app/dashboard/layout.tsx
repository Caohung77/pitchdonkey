'use client'

import { useState, useEffect } from 'react'
import { createClientSupabase } from '@/lib/supabase-client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  Bell,
  ChevronDown,
  CreditCard,
  HelpCircle,
  Home,
  LogOut,
  Mail,
  Menu,
  Settings,
  Users,
  Zap,
  Target,
  Shield,
  Palette,
  X,
  AlertCircle,
  Inbox,
  Bot,
  ShieldCheck
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent } from '@/components/ui/card'
import { EnrichmentProgressBar } from '@/components/enrichment/EnrichmentProgressBar'
import { ToastProvider } from '@/components/ui/toast'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  isRead: boolean
  createdAt: string
}

const getNavigation = (userEmail?: string) => {
  const baseNav = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Mailbox', href: '/dashboard/mailbox', icon: Inbox },
    { name: 'Scheduled Replies', href: '/dashboard/scheduled-replies', icon: Bot },
    { name: 'Campaigns', href: '/dashboard/campaigns', icon: Target },
    { name: 'Contacts', href: '/dashboard/contacts', icon: Users },
    { name: 'Email Accounts', href: '/dashboard/email-accounts', icon: Mail },
    { name: 'AI Outreach Agents', href: '/dashboard/outreach-agents', icon: Zap },
    { name: 'AI Templates', href: '/dashboard/ai-templates', icon: Palette },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ]

  // Add Admin menu item for admin user
  if (userEmail === 'banbau@gmx.net') {
    baseNav.push({ name: 'Admin', href: '/dashboard/admin/fix-bounces', icon: ShieldCheck })
  }

  return baseNav
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const pathname = usePathname()
  const { user, loading, error, signOut } = useAuth()

  // Fetch notifications and set up real-time subscriptions
  useEffect(() => {
    if (user) {
      fetchNotifications()

      // Set up real-time subscription for new notifications
      const supabase = createClientSupabase()
      const subscription = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🔔 Real-time notification update:', payload)

            if (payload.eventType === 'INSERT') {
              // New notification - add to list and increment unread count
              const newNotification = {
                id: payload.new.id,
                title: payload.new.title || 'Notification',
                message: payload.new.message || '',
                type: payload.new.type || 'info',
                isRead: payload.new.is_read || false,
                createdAt: payload.new.created_at,
                data: payload.new.data || {}
              }

              setNotifications(prev => [newNotification, ...prev])
              if (!newNotification.isRead) {
                setUnreadCount(prev => prev + 1)
              }
            } else if (payload.eventType === 'UPDATE') {
              // Updated notification (e.g., marked as read)
              setNotifications(prev =>
                prev.map(notif =>
                  notif.id === payload.new.id
                    ? {
                        ...notif,
                        isRead: payload.new.is_read,
                        title: payload.new.title || notif.title,
                        message: payload.new.message || notif.message,
                        type: payload.new.type || notif.type
                      }
                    : notif
                )
              )

              // Recalculate unread count
              setUnreadCount(prev => {
                const wasRead = payload.old?.is_read
                const isRead = payload.new.is_read
                if (!wasRead && isRead) {
                  return Math.max(0, prev - 1)
                } else if (wasRead && !isRead) {
                  return prev + 1
                }
                return prev
              })
            }
          }
        )
        .subscribe()

      // Also set up a fallback polling every 2 minutes (in case real-time fails)
      const interval = setInterval(fetchNotifications, 120000)

      return () => {
        subscription.unsubscribe()
        clearInterval(interval)
      }
    } else {
      setNotifications([])
      setUnreadCount(0)
    }
  }, [user])

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=10')
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setNotifications(result.data.notifications || [])
          setUnreadCount(result.data.unread_count || 0)
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
      // Don't throw error to prevent layout breaking
    }
  }

  // Removed fetchNotifications to prevent 401 errors that cause authentication loops
  // This was causing users to be signed out when the notifications API failed

  const markNotificationRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST'
      })

      if (response.ok) {
        // Real-time subscription will handle the UI update
        console.log(`✅ Marked notification ${notificationId} as read`)
      } else {
        // Fallback to local update if API fails
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
      // Fallback to local update
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  const getPlanBadgeColor = (plan: string) => {
    switch (plan?.toLowerCase()) {
      case 'starter': return 'bg-blue-100 text-blue-800'
      case 'professional': return 'bg-purple-100 text-purple-800'
      case 'agency': return 'bg-gold-100 text-gold-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning': return '⚠️'
      case 'error': return '❌'
      case 'success': return '✅'
      default: return 'ℹ️'
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()} className="w-full">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No user state (should not happen due to redirect, but just in case)
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Required</h2>
              <p className="text-gray-600 mb-4">
                Please sign in to access the dashboard.
              </p>
              <div className="space-y-2">
                <Button 
                  onClick={() => window.location.href = '/auth/signin'}
                  className="w-full"
                >
                  Go to Sign In
                </Button>
                <Button 
                  onClick={() => window.location.href = '/debug-auth'}
                  variant="outline"
                  className="w-full"
                >
                  Debug Auth
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <div className="flex items-center">
              <img src="/images/eisbrief-name-logo.png" alt="Eisbrief" className="h-8 w-auto max-w-[140px]" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {getNavigation(user?.email).map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-4 border-b">
            <img src="/images/eisbrief-name-logo.png" alt="Eisbrief" className="h-8 w-auto max-w-[140px]" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {getNavigation(user?.email).map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          
          {/* User info at bottom */}
          {user && (
            <div className="flex-shrink-0 border-t border-gray-200 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">{user.name || 'User'}</p>
                  <Badge className={`text-xs ${getPlanBadgeColor(user.plan)}`}>
                    {user.plan}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top navigation */}
        <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center">
              {/* Enrichment progress bar */}
              <EnrichmentProgressBar userId={user?.id} compact={true} />
            </div>

            {/* Notifications */}
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length > 0 ? (
                    notifications.slice(0, 5).map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className="flex items-start space-x-2 p-3"
                        onClick={() => markNotificationRead(notification.id)}
                      >
                        <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{notification.title}</p>
                          <p className="text-xs text-muted-foreground">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="h-2 w-2 bg-blue-600 rounded-full" />
                        )}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>
                      <span className="text-sm text-muted-foreground">No notifications</span>
                    </DropdownMenuItem>
                  )}
                  {notifications.length > 5 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/notifications" className="text-center">
                          View all notifications
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div>
                      <p className="font-medium">{user?.name || 'User'}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings/profile">
                      <Settings className="mr-2 h-4 w-4" />
                      Profile Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/billing">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Billing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/help">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      Help & Support
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
      </div>
    </ToastProvider>
  )
}
