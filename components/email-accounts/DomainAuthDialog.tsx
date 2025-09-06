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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Shield, CheckCircle, XCircle, AlertCircle, Copy, RefreshCw, ExternalLink } from 'lucide-react'
import { ApiClient } from '@/lib/api-client'

interface DomainAuthDialogProps {
  domain: string
}

interface DNSRecord {
  type: string
  name: string
  prefix?: string  // Prefix format for German providers
  value: string
  status: 'verified' | 'pending' | 'missing' | 'error'
}

interface DomainAuthStatus {
  domain: string
  spf: {
    verified: boolean
    record?: string
    error?: string
  }
  dkim: {
    verified: boolean
    record?: string
    selector?: string
    error?: string
  }
  dmarc: {
    verified: boolean
    record?: string
    error?: string
  }
  overallStatus: 'verified' | 'partial' | 'unverified' | 'error'
  lastChecked?: string
}

export default function DomainAuthDialog({ domain }: DomainAuthDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [status, setStatus] = useState<DomainAuthStatus | null>(null)
  const [generatedRecords, setGeneratedRecords] = useState<DNSRecord[]>([])
  const [error, setError] = useState('')
  const [dkimSelector, setDkimSelector] = useState<string>('coldreach2024')
  const [recordMeta, setRecordMeta] = useState<{ providers?: string[]; smtpHosts?: string[]; smtpIps?: string[] } | null>(null)

  useEffect(() => {
    if (open) {
      fetchDomainStatus()
      generateDNSRecords()
    }
  }, [open, domain])

  const fetchDomainStatus = async () => {
    setIsLoading(true)
    setError('')

    try {
      const data = await ApiClient.get(`/api/domains/${encodeURIComponent(domain)}/status`)
      setStatus(data.status)
    } catch (error) {
      console.error('Error fetching domain status:', error)
      setError('Failed to load domain authentication status')
    } finally {
      setIsLoading(false)
    }
  }

  const generateDNSRecords = async () => {
    try {
      const data = await ApiClient.get(`/api/domains/${encodeURIComponent(domain)}/records`)
      setGeneratedRecords(data.records)
      if (data.selector) setDkimSelector(data.selector)
      if (data.meta) setRecordMeta(data.meta)
    } catch (error) {
      console.error('Error generating DNS records:', error)
    }
  }

  const handleVerify = async () => {
    setIsVerifying(true)
    setError('')

    try {
      const data = await ApiClient.post(`/api/domains/${encodeURIComponent(domain)}/verify`, {})
      setStatus(data.status)
    } catch (error) {
      console.error('Error verifying domain:', error)
      setError('Failed to verify domain authentication')
    } finally {
      setIsVerifying(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
  }

  const getStatusIcon = (verified: boolean, hasError: boolean = false) => {
    if (hasError) return <XCircle className="h-4 w-4 text-red-500" />
    if (verified) return <CheckCircle className="h-4 w-4 text-green-500" />
    return <AlertCircle className="h-4 w-4 text-yellow-500" />
  }

  const getStatusBadge = (verified: boolean, hasError: boolean = false) => {
    if (hasError) return <Badge variant="destructive">Error</Badge>
    if (verified) return <Badge variant="default" className="bg-green-500">Verified</Badge>
    return <Badge variant="secondary">Pending</Badge>
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Shield className="h-4 w-4 mr-1" />
          Domain Auth
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Domain Authentication - {domain}
          </DialogTitle>
          <DialogDescription>
            Set up SPF, DKIM, and DMARC records to improve email deliverability and security
          </DialogDescription>
        </DialogHeader>

        {/* Development Mode Notice */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-blue-600 mr-2" />
            <span className="text-blue-800 text-sm">
              <strong>Development Mode:</strong> These are sample DNS records for demonstration. 
              In production, you would add these to your actual DNS provider.
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <XCircle className="h-4 w-4 text-red-600 mr-2" />
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Status Overview */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Authentication Status</CardTitle>
                <Button 
                  size="sm" 
                  onClick={handleVerify} 
                  disabled={isVerifying}
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isVerifying ? 'animate-spin' : ''}`} />
                  {isVerifying ? 'Verifying...' : 'Verify Now'}
                </Button>
              </div>
              {status?.lastChecked && (
                <CardDescription>
                  Last checked: {new Date(status.lastChecked).toLocaleString()}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                      <div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  ))}
                </div>
              ) : status ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(status.spf.verified, !!status.spf.error)}
                      <div>
                        <div className="font-medium">SPF (Sender Policy Framework)</div>
                        <div className="text-sm text-muted-foreground">
                          Authorizes email servers to send on your behalf
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(status.spf.verified, !!status.spf.error)}
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(status.dkim.verified, !!status.dkim.error)}
                      <div>
                        <div className="font-medium">DKIM (DomainKeys Identified Mail)</div>
                        <div className="text-sm text-muted-foreground">
                          Cryptographically signs your emails
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(status.dkim.verified, !!status.dkim.error)}
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(status.dmarc.verified, !!status.dmarc.error)}
                      <div>
                        <div className="font-medium">DMARC (Domain-based Message Authentication)</div>
                        <div className="text-sm text-muted-foreground">
                          Tells receivers what to do with unauthenticated emails
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(status.dmarc.verified, !!status.dmarc.error)}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  Click "Verify Now" to check your domain authentication status
                </div>
              )}
            </CardContent>
          </Card>

          {/* DNS Records Setup */}
          <Tabs defaultValue="spf" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="spf">SPF Setup</TabsTrigger>
              <TabsTrigger value="dkim">DKIM Setup</TabsTrigger>
              <TabsTrigger value="dmarc">DMARC Setup</TabsTrigger>
            </TabsList>

            <TabsContent value="spf" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">SPF Record Setup</CardTitle>
                  <CardDescription>
                    Add this TXT record to your DNS to authorize email servers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {generatedRecords.filter(r => r.type === 'SPF').map((record, index) => (
                    <div key={index} className="space-y-2">
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div className="font-medium">Type:</div>
                        <div className="col-span-3">TXT</div>
                        <div className="font-medium">Name:</div>
                        <div className="col-span-3">
                          <div className="font-mono text-xs">@</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            German providers: Use "@"<br/>
                            Some providers: Leave blank or use root domain
                          </div>
                        </div>
                        <div className="font-medium">Value:</div>
                        <div className="col-span-3 font-mono text-xs bg-gray-50 p-2 rounded border break-all">
                          {record.value}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-2 h-6 w-6 p-0"
                            onClick={() => copyToClipboard(record.value)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p><strong>What this does:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Tells receiving servers which servers can send emails from your domain</li>
                      <li>Helps prevent email spoofing and improves deliverability</li>
                      <li>Required by most email providers for good reputation</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dkim" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">DKIM Record Setup</CardTitle>
                  <CardDescription>
                    Add this TXT record to enable DKIM email signing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {generatedRecords.filter(r => r.type === 'DKIM').map((record, index) => (
                    <div key={index} className="space-y-2">
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div className="font-medium">Type:</div>
                        <div className="col-span-3">TXT</div>
                        <div className="font-medium">Name:</div>
                        <div className="col-span-3">
                          <div className="font-mono text-xs">{record.prefix || record.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            German providers (Strato, 1&1): Use prefix "{record.prefix}"<br/>
                            Other providers: Use full name "{record.name}"
                          </div>
                        </div>
                        <div className="font-medium">Value:</div>
                        <div className="col-span-3 font-mono text-xs bg-gray-50 p-2 rounded border break-all max-h-32 overflow-y-auto">
                          {record.value}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-2 h-6 w-6 p-0"
                            onClick={() => copyToClipboard(record.value)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p><strong>What this does:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Adds a cryptographic signature to your emails</li>
                      <li>Proves emails actually came from your domain</li>
                      <li>Significantly improves email deliverability</li>
                      <li>Required for DMARC compliance</li>
                    </ul>
                    <p className="text-yellow-600">
                      <strong>Note:</strong> Keep your private key secure - never share it or put it in DNS
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dmarc" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">DMARC Record Setup</CardTitle>
                  <CardDescription>
                    Start with monitoring, then gradually strengthen the policy
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {generatedRecords.filter(r => r.type === 'DMARC').map((record, index) => (
                    <div key={index} className="space-y-2">
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div className="font-medium">Type:</div>
                        <div className="col-span-3">TXT</div>
                        <div className="font-medium">Name:</div>
                        <div className="col-span-3">
                          <div className="font-mono text-xs">_dmarc</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            All providers: Use "_dmarc" as prefix/name
                          </div>
                        </div>
                        <div className="font-medium">Value:</div>
                        <div className="col-span-3 font-mono text-xs bg-gray-50 p-2 rounded border break-all">
                          {record.value}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-2 h-6 w-6 p-0"
                            onClick={() => copyToClipboard(record.value)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p><strong>Progressive Implementation:</strong></p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li><strong>Start:</strong> p=none (monitoring only)</li>
                      <li><strong>Test:</strong> p=quarantine; pct=25 (quarantine 25%)</li>
                      <li><strong>Increase:</strong> p=quarantine; pct=100 (quarantine all)</li>
                      <li><strong>Final:</strong> p=reject (reject all failing emails)</li>
                    </ol>
                    <p className="text-yellow-600">
                      <strong>Important:</strong> Never jump straight to "reject" - test thoroughly first!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Help Links */}
          {recordMeta && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Provider‑Specific Notes</CardTitle>
                <CardDescription>Instructions tailored to your current email account settings.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {recordMeta.providers && recordMeta.providers.length > 0 && (
                  <p>
                    Detected providers: <span className="font-mono">{recordMeta.providers.join(', ')}</span>. Your SPF includes these providers so mail sent through them is authorized.
                  </p>
                )}
                {recordMeta.smtpHosts && recordMeta.smtpHosts.length > 0 && (
                  <p>
                    Custom SMTP host(s): <span className="font-mono">{recordMeta.smtpHosts.join(', ')}</span>. We resolved their IPs and added ip4/ip6 to your SPF. DKIM uses selector <span className="font-mono">{dkimSelector}</span>.
                  </p>
                )}
                <p className="text-gray-600">IMAP is for receiving; SPF/DKIM/DMARC depend on your sending (SMTP) settings only.</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Popular DNS Providers:</h4>
                  <ul className="space-y-1">
                    <li>
                      <a href="https://www.godaddy.com/help/add-a-txt-record-19232" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                        GoDaddy DNS Setup <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </li>
                    <li>
                      <a href="https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                        Cloudflare DNS Setup <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </li>
                    <li>
                      <a href="https://www.namecheap.com/support/knowledgebase/article.aspx/317/2237/how-do-i-add-txtspfdkimdmarc-records-for-my-domain/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                        Namecheap DNS Setup <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Testing Tools:</h4>
                  <ul className="space-y-1">
                    <li>
                      <a href={`https://mxtoolbox.com/spf.aspx?domain=${domain}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                        Test SPF Record <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </li>
                    <li>
                      <a href={`https://mxtoolbox.com/dkim.aspx?domain=${domain}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                        Test DKIM Record <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </li>
                    <li>
                      <a href={`https://mxtoolbox.com/dmarc.aspx?domain=${domain}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                        Test DMARC Record <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
