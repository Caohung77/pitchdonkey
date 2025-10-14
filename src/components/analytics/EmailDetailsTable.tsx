'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Search, 
  Filter, 
  Mail, 
  CheckCircle, 
  Eye, 
  MousePointer, 
  Reply, 
  AlertTriangle,
  Clock,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { ApiClient } from '@/lib/api-client'

interface EmailDetailsTableProps {
  campaignId: string
  analytics: any
}

interface EmailDetails {
  id: string
  recipient_email: string
  subject: string
  status: string
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  clicked_at: string | null
  replied_at: string | null
  bounce_reason: string | null
  contact_name?: string
  contact_company?: string
}

export function EmailDetailsTable({ campaignId, analytics }: EmailDetailsTableProps) {
  const [emailDetails, setEmailDetails] = useState<EmailDetails[]>([])
  const [filteredEmails, setFilteredEmails] = useState<EmailDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 20

  const fetchEmailDetails = async () => {
    try {
      setLoading(true)
      // Fetch real email details for this campaign
      const res = await ApiClient.get(`/api/campaigns/${campaignId}/email-details?page=1&pageSize=200`)
      if (res?.success) {
        const items = res.data.items as EmailDetails[]
        setEmailDetails(items)
        setTotalCount(res.data.count || items.length)
      } else {
        console.error('Email details API returned error', res)
        setEmailDetails([])
        setTotalCount(0)
      }
    } catch (error) {
      console.error('Error fetching email details:', error)
      setEmailDetails([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmailDetails()
  }, [campaignId])

  useEffect(() => {
    // Filter emails based on search term and status
    let filtered = emailDetails

    if (searchTerm) {
      filtered = filtered.filter(email => 
        email.recipient_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.subject.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(email => email.status === statusFilter)
    }

    setFilteredEmails(filtered)
    setCurrentPage(1) // Reset to first page when filtering
  }, [emailDetails, searchTerm, statusFilter])

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      sent: { color: 'bg-blue-100 text-blue-800', icon: Mail },
      delivered: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      opened: { color: 'bg-yellow-100 text-yellow-800', icon: Eye },
      clicked: { color: 'bg-purple-100 text-purple-800', icon: MousePointer },
      replied: { color: 'bg-emerald-100 text-emerald-800', icon: Reply },
      bounced: { color: 'bg-red-100 text-red-800', icon: AlertTriangle },
      failed: { color: 'bg-red-100 text-red-800', icon: AlertTriangle }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.sent
    const IconComponent = config.icon
    
    return (
      <Badge className={config.color}>
        <IconComponent className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const exportToCSV = () => {
    const csvData = [
      ['Email', 'Name', 'Company', 'Subject', 'Status', 'Sent At', 'Delivered At', 'Opened At', 'Clicked At', 'Replied At', 'Bounce Reason'],
      ...filteredEmails.map(email => [
        email.recipient_email,
        email.contact_name || '',
        email.contact_company || '',
        email.subject,
        email.status,
        email.sent_at ? formatDate(email.sent_at) : '',
        email.delivered_at ? formatDate(email.delivered_at) : '',
        email.opened_at ? formatDate(email.opened_at) : '',
        email.clicked_at ? formatDate(email.clicked_at) : '',
        email.replied_at ? formatDate(email.replied_at) : '',
        email.bounce_reason || ''
      ])
    ]
    
    const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `campaign-${campaignId}-email-details.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Pagination
  const totalPages = Math.ceil(filteredEmails.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentEmails = filteredEmails.slice(startIndex, endIndex)

  const uniqueStatuses = Array.from(new Set(emailDetails.map(email => email.status)))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Email Details</CardTitle>
            <CardDescription>
              Individual email tracking and status details
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={fetchEmailDetails} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex items-center space-x-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search emails, names, or subjects..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
          
          <div className="text-sm text-gray-500">
            {filteredEmails.length} of {totalCount} emails
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium text-sm">Recipient</th>
                <th className="text-left py-2 px-3 font-medium text-sm">Subject</th>
                <th className="text-left py-2 px-3 font-medium text-sm">Status</th>
                <th className="text-left py-2 px-3 font-medium text-sm">Sent</th>
                <th className="text-left py-2 px-3 font-medium text-sm">Delivered</th>
                <th className="text-left py-2 px-3 font-medium text-sm">Opened</th>
                <th className="text-left py-2 px-3 font-medium text-sm">Last Action</th>
              </tr>
            </thead>
            <tbody>
              {currentEmails.map((email) => (
                <tr key={email.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-3">
                    <div>
                      <div className="font-medium text-sm">{email.recipient_email}</div>
                      {email.contact_name && (
                        <div className="text-xs text-gray-500">
                          {email.contact_name}
                          {email.contact_company && ` • ${email.contact_company}`}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-sm font-medium truncate max-w-xs" title={email.subject}>
                      {email.subject}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    {getStatusBadge(email.status)}
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-600">
                    {formatDate(email.sent_at)}
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-600">
                    {formatDate(email.delivered_at)}
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-600">
                    {formatDate(email.opened_at)}
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-600">
                    {email.replied_at ? (
                      <div className="flex items-center space-x-1 text-green-600">
                        <Reply className="h-3 w-3" />
                        <span>{formatDate(email.replied_at)}</span>
                      </div>
                    ) : email.clicked_at ? (
                      <div className="flex items-center space-x-1 text-purple-600">
                        <MousePointer className="h-3 w-3" />
                        <span>{formatDate(email.clicked_at)}</span>
                      </div>
                    ) : email.opened_at ? (
                      <div className="flex items-center space-x-1 text-yellow-600">
                        <Eye className="h-3 w-3" />
                        <span>{formatDate(email.opened_at)}</span>
                      </div>
                    ) : email.bounce_reason ? (
                      <div className="flex items-center space-x-1 text-red-600" title={email.bounce_reason}>
                        <AlertTriangle className="h-3 w-3" />
                        <span>Bounced</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span>Pending</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredEmails.length)} of {filteredEmails.length} emails
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {currentEmails.length === 0 && !loading && (
          <div className="text-center py-8">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No emails found</h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria' 
                : 'No email details available for this campaign'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
