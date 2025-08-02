'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Upload, X, FileText, CheckCircle, XCircle } from 'lucide-react'

interface ImportContactsModalProps {
  onImportComplete: () => void
}

interface ImportResult {
  created: number
  skipped: number
  errors: Array<{
    row: number
    error: string
    data: any
  }>
  validationSummary: {
    total: number
    valid: number
    invalid: number
    risky: number
  }
}

export function ImportContactsModal({ onImportComplete }: ImportContactsModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setSelectedFile(file)
    setError(null)
    setImportResult(null)
  }

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Please select a CSV file')
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('ImportContactsModal: Starting import of file:', selectedFile.name)
      
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('skipDuplicates', 'true')
      formData.append('validateEmails', 'true')

      const response = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import contacts')
      }

      console.log('ImportContactsModal: Import completed:', data)
      setImportResult(data.data)
      
      // Call the completion callback to refresh the contacts list
      onImportComplete()

    } catch (error) {
      console.error('ImportContactsModal: Error importing contacts:', error)
      setError(error instanceof Error ? error.message : 'Failed to import contacts')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setError(null)
    setSelectedFile(null)
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleStartOver = () => {
    setSelectedFile(null)
    setImportResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (!isOpen) {
    return (
      <Button 
        variant="outline" 
        onClick={() => setIsOpen(true)} 
        className="flex items-center space-x-2"
      >
        <Upload className="h-4 w-4" />
        <span>Import CSV</span>
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Import Contacts from CSV</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Import Results */}
          {importResult && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-medium text-gray-900">Import Complete!</h3>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{importResult.created}</div>
                    <div className="text-xs text-gray-600">Created</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{importResult.skipped}</div>
                    <div className="text-xs text-gray-600">Skipped</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">{importResult.errors.length}</div>
                    <div className="text-xs text-gray-600">Errors</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{importResult.validationSummary.total}</div>
                    <div className="text-xs text-gray-600">Total</div>
                  </CardContent>
                </Card>
              </div>

              {/* Email Validation Summary */}
              {importResult.validationSummary.total > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Email Validation Summary</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{importResult.validationSummary.valid}</div>
                        <div className="text-gray-600">Valid</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-yellow-600">{importResult.validationSummary.risky}</div>
                        <div className="text-gray-600">Risky</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-600">{importResult.validationSummary.invalid}</div>
                        <div className="text-gray-600">Invalid</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                      <XCircle className="h-4 w-4 text-red-600 mr-2" />
                      Import Errors ({importResult.errors.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {importResult.errors.slice(0, 10).map((error, index) => (
                        <div key={index} className="text-sm bg-red-50 p-2 rounded">
                          <div className="font-medium text-red-800">Row {error.row}: {error.error}</div>
                          {error.data && (
                            <div className="text-red-600 text-xs mt-1">
                              {JSON.stringify(error.data).substring(0, 100)}...
                            </div>
                          )}
                        </div>
                      ))}
                      {importResult.errors.length > 10 && (
                        <div className="text-sm text-gray-600 text-center">
                          ... and {importResult.errors.length - 10} more errors
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={handleStartOver}>
                  Import Another File
                </Button>
                <Button onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* File Upload Interface */}
          {!importResult && (
            <div className="space-y-4">
              {/* Instructions */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">CSV Format Requirements</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Required column: <code>email</code></li>
                  <li>• Optional columns: <code>first_name</code>, <code>last_name</code>, <code>company</code>, <code>position</code>, <code>phone</code>, <code>website</code></li>
                  <li>• First row should contain column headers</li>
                  <li>• Maximum file size: 10MB</li>
                  <li>• Duplicate emails will be skipped automatically</li>
                </ul>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
                  <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                  <span className="text-red-800 text-sm">{error}</span>
                </div>
              )}

              {/* File Selection */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  
                  {selectedFile ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-600">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Choose Different File
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        Click to select a CSV file or drag and drop
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Select CSV File
                      </Button>
                    </div>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Import Options */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Import Options</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <input type="checkbox" checked disabled className="mr-2" />
                    Skip duplicate emails (recommended)
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" checked disabled className="mr-2" />
                    Validate email addresses (recommended)
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={!selectedFile || loading}
                >
                  {loading ? 'Importing...' : 'Import Contacts'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}