'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Upload, X, FileText, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { FieldMappingPreview } from './FieldMappingPreview'

interface ImportContactsModalProps {
  onImportComplete: () => void
}

interface FieldMapping {
  csvField: string
  contactField: string
  required: boolean
  example?: string
  confidence?: number
}

interface PreviewData {
  headers: string[]
  sampleRows: Record<string, string>[]
  fieldMappings: FieldMapping[]
  previewContacts: Array<{
    contact: Record<string, any>
    rowIndex: number
    errors: string[]
  }>
  totalRows: number
  parseErrors: Array<{
    row: number
    error: string
  }>
  detectedDelimiter: string
}

type ImportStep = 'file-upload' | 'field-mapping' | 'importing' | 'results'

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
  const [currentStep, setCurrentStep] = useState<ImportStep>('file-upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [customFieldMappings, setCustomFieldMappings] = useState<FieldMapping[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setPreviewData(null)
    setCustomFieldMappings([])

    // Generate preview data
    await generatePreview(file)
  }

  const generatePreview = async (file: File) => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/contacts/import', {
        method: 'PUT', // Use PUT for preview
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to preview CSV file')
      }

      setPreviewData(data.data)
      setCustomFieldMappings(data.data.fieldMappings || [])
      
    } catch (error) {
      console.error('Error generating preview:', error)
      setError(error instanceof Error ? error.message : 'Failed to preview CSV file')
    } finally {
      setLoading(false)
    }
  }

  const handleMappingChange = (csvField: string, contactField: string) => {
    console.log(`ImportContactsModal: Mapping ${csvField} to ${contactField}`)
    setCustomFieldMappings(prev => {
      const updated = prev.map(mapping => 
        mapping.csvField === csvField 
          ? { ...mapping, contactField }
          : mapping
      )
      console.log('ImportContactsModal: Updated mappings:', updated)
      return updated
    })
  }

  const proceedToImport = () => {
    // Validate mappings before proceeding - only email is required
    const requiredFields = ['email']
    const mappedRequiredFields = new Set(
      customFieldMappings
        .filter(m => m.csvField && m.csvField !== '__skip__' && requiredFields.includes(m.contactField))
        .map(m => m.contactField)
    )

    const missingRequired = requiredFields.filter(field => !mappedRequiredFields.has(field))
    
    if (missingRequired.length > 0) {
      setError(`Please map the required field: ${missingRequired.join(', ')}`)
      return
    }

    setError(null)
    setCurrentStep('importing')
    handleImport()
  }

  const handleImport = async () => {
    if (!selectedFile || !customFieldMappings) {
      setError('Please select a CSV file and configure field mappings')
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('ImportContactsModal: Starting import of file:', selectedFile.name)
      
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('mappings', JSON.stringify(customFieldMappings))
      formData.append('options', JSON.stringify({
        skipDuplicates: true,
        validateEmails: true,
        importInvalidContacts: false
      }))

      const response = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import contacts')
        setCurrentStep('field-mapping') // Go back to mapping step on error
        return
      }

      console.log('ImportContactsModal: Import completed:', data)
      setImportResult(data.data)
      setCurrentStep('results')
      
      // Call the completion callback to refresh the contacts list
      onImportComplete()

    } catch (error) {
      console.error('ImportContactsModal: Error importing contacts:', error)
      setError(error instanceof Error ? error.message : 'Failed to import contacts')
      setCurrentStep('field-mapping') // Go back to mapping step on error
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setCurrentStep('file-upload')
    setError(null)
    setSelectedFile(null)
    setPreviewData(null)
    setCustomFieldMappings([])
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleStartOver = () => {
    setCurrentStep('file-upload')
    setSelectedFile(null)
    setPreviewData(null)
    setCustomFieldMappings([])
    setImportResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const goBackToFileUpload = () => {
    setCurrentStep('file-upload')
    setError(null)
  }

  const proceedToMapping = () => {
    if (previewData) {
      setCurrentStep('field-mapping')
      setError(null)
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

  const getStepTitle = () => {
    switch (currentStep) {
      case 'file-upload': return 'Select CSV File'
      case 'field-mapping': return 'Configure Field Mapping'
      case 'importing': return 'Importing Contacts'
      case 'results': return 'Import Complete'
      default: return 'Import Contacts from CSV'
    }
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-4 mb-6">
      <div className={`flex items-center ${currentStep === 'file-upload' ? 'text-blue-600' : currentStep === 'field-mapping' || currentStep === 'importing' || currentStep === 'results' ? 'text-green-600' : 'text-gray-400'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 'file-upload' ? 'bg-blue-100 text-blue-600' : currentStep === 'field-mapping' || currentStep === 'importing' || currentStep === 'results' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
          1
        </div>
        <span className="ml-2 text-sm font-medium">Upload File</span>
      </div>
      
      <div className={`w-8 h-0.5 ${currentStep === 'field-mapping' || currentStep === 'importing' || currentStep === 'results' ? 'bg-green-600' : 'bg-gray-300'}`}></div>
      
      <div className={`flex items-center ${currentStep === 'field-mapping' ? 'text-blue-600' : currentStep === 'importing' || currentStep === 'results' ? 'text-green-600' : 'text-gray-400'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 'field-mapping' ? 'bg-blue-100 text-blue-600' : currentStep === 'importing' || currentStep === 'results' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
          2
        </div>
        <span className="ml-2 text-sm font-medium">Map Fields</span>
      </div>
      
      <div className={`w-8 h-0.5 ${currentStep === 'results' ? 'bg-green-600' : 'bg-gray-300'}`}></div>
      
      <div className={`flex items-center ${currentStep === 'results' ? 'text-green-600' : 'text-gray-400'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === 'results' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
          3
        </div>
        <span className="ml-2 text-sm font-medium">Complete</span>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{getStepTitle()}</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {currentStep !== 'results' && currentStep !== 'importing' && renderStepIndicator()}
        </CardHeader>
        
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          )}

          {/* Step 1: File Upload */}
          {currentStep === 'file-upload' && (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">CSV Format Requirements</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Required column:</strong> <code>email</code> (only field that's mandatory)</li>
                  <li>• <strong>Optional columns:</strong> <code>first_name</code>, <code>last_name</code>, <code>company</code>, <code>position</code>, <code>phone</code>, <code>website</code>, <code>address</code>, <code>postcode</code></li>
                  <li>• First row should contain column headers</li>
                  <li>• Maximum file size: 10MB</li>
                  <li>• You can customize field mappings in the next step</li>
                  <li>• Any unmapped columns will be saved as custom fields</li>
                </ul>
              </div>

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
                        disabled={loading}
                      >
                        Choose Different File
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        Click to select a CSV file
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading}
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

              {loading && (
                <div className="text-center text-sm text-gray-600">
                  Analyzing CSV file...
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={proceedToMapping} 
                  disabled={!previewData || loading}
                >
                  Next: Configure Mapping
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Field Mapping */}
          {currentStep === 'field-mapping' && previewData && (
            <div className="space-y-6">
              <FieldMappingPreview
                headers={previewData.headers}
                sampleRows={previewData.sampleRows}
                fieldMappings={customFieldMappings}
                onMappingChange={handleMappingChange}
                errors={[]}
              />
              
              {/* Actions */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={goBackToFileUpload}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button onClick={proceedToImport}>
                  Import Contacts
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {currentStep === 'importing' && (
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600">Importing your contacts...</p>
              <p className="text-sm text-gray-500">This may take a few moments depending on file size</p>
            </div>
          )}

          {/* Step 4: Results */}
          {currentStep === 'results' && importResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <h3 className="text-xl font-medium text-gray-900">Import Complete!</h3>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{importResult.created}</div>
                    <div className="text-sm text-gray-600">Created</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-600">{importResult.skipped}</div>
                    <div className="text-sm text-gray-600">Skipped</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-red-600">{importResult.errors.length}</div>
                    <div className="text-sm text-gray-600">Errors</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600">{importResult.validationSummary?.total || 0}</div>
                    <div className="text-sm text-gray-600">Total Processed</div>
                  </CardContent>
                </Card>
              </div>

              {/* Email Validation Summary */}
              {importResult.validationSummary && importResult.validationSummary.total > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Email Validation Summary</h4>
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
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <XCircle className="h-4 w-4 text-red-600 mr-2" />
                      Import Errors ({importResult.errors.length})
                    </h4>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {importResult.errors.slice(0, 10).map((error, index) => (
                        <div key={index} className="text-sm bg-red-50 p-3 rounded">
                          <div className="font-medium text-red-800">Row {error.row}: {error.error}</div>
                          {error.data && (
                            <div className="text-red-600 text-xs mt-1">
                              Data: {JSON.stringify(error.data).substring(0, 100)}
                              {JSON.stringify(error.data).length > 100 && '...'}
                            </div>
                          )}
                        </div>
                      ))}
                      {importResult.errors.length > 10 && (
                        <div className="text-sm text-gray-600 text-center py-2">
                          ... and {importResult.errors.length - 10} more errors
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex justify-center space-x-3 pt-4">
                <Button variant="outline" onClick={handleStartOver}>
                  Import Another File
                </Button>
                <Button onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}