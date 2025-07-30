'use client'

import React, { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  X,
  Download,
  Eye,
  Settings
} from 'lucide-react'
import { CSVParser } from '@/lib/csv-parser'

interface FieldMapping {
  csvField: string
  contactField: string
  required: boolean
  example?: string
}

interface ImportStep {
  step: 'upload' | 'mapping' | 'preview' | 'processing' | 'complete'
  title: string
  description: string
}

interface ContactImportDialogProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: (result: any) => void
}

const IMPORT_STEPS: ImportStep[] = [
  {
    step: 'upload',
    title: 'Upload CSV File',
    description: 'Select or drag and drop your CSV file'
  },
  {
    step: 'mapping',
    title: 'Map Fields',
    description: 'Map CSV columns to contact fields'
  },
  {
    step: 'preview',
    title: 'Preview Data',
    description: 'Review your contacts before importing'
  },
  {
    step: 'processing',
    title: 'Processing',
    description: 'Importing your contacts...'
  },
  {
    step: 'complete',
    title: 'Complete',
    description: 'Import finished successfully'
  }
]

export function ContactImportDialog({ 
  isOpen, 
  onClose, 
  onImportComplete 
}: ContactImportDialogProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep['step']>('upload')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<any>(null)
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [previewData, setPreviewData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file')
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('File size must be less than 10MB')
      return
    }

    setCsvFile(file)

    try {
      const content = await file.text()
      const delimiter = CSVParser.detectDelimiter(content)
      const parseResult = CSVParser.parseCSV(content, { delimiter })

      if (parseResult.errors.length > 0 && parseResult.rows.length === 0) {
        alert('Failed to parse CSV file. Please check the format.')
        return
      }

      setCsvData(parseResult)
      
      // Auto-detect field mappings
      const mappings = CSVParser.detectFieldMappings(parseResult.headers)
      setFieldMappings(mappings)
      
      setCurrentStep('mapping')
    } catch (error) {
      console.error('Error parsing CSV:', error)
      alert('Failed to parse CSV file')
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleMappingChange = (index: number, csvField: string) => {
    const newMappings = [...fieldMappings]
    newMappings[index].csvField = csvField
    setFieldMappings(newMappings)
  }

  const validateMappings = () => {
    const errors = CSVParser.validateFieldMappings(fieldMappings)
    if (errors.length > 0) {
      alert(errors.join('\n'))
      return false
    }
    return true
  }

  const handlePreview = () => {
    if (!validateMappings()) return

    const transformResults = CSVParser.transformRowsToContacts(csvData.rows, fieldMappings)
    const sampleData = transformResults.slice(0, 10) // Show first 10 rows
    setPreviewData(sampleData)
    setCurrentStep('preview')
  }

  const handleImport = async () => {
    if (!validateMappings()) return

    setCurrentStep('processing')
    setIsProcessing(true)

    try {
      const transformResults = CSVParser.transformRowsToContacts(csvData.rows, fieldMappings)
      const validContacts = transformResults
        .filter(result => result.errors.length === 0)
        .map(result => result.contact)

      // Call the bulk import API
      const response = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contacts: validContacts,
          skip_duplicates: true,
          validate_emails: true
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Import failed')
      }

      setImportResult(result.data)
      setCurrentStep('complete')
      onImportComplete(result.data)

    } catch (error) {
      console.error('Import error:', error)
      alert('Import failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setCurrentStep('preview')
    } finally {
      setIsProcessing(false)
    }
  }

  const resetDialog = () => {
    setCurrentStep('upload')
    setCsvFile(null)
    setCsvData(null)
    setFieldMappings([])
    setPreviewData([])
    setImportResult(null)
    setIsProcessing(false)
  }

  const handleClose = () => {
    resetDialog()
    onClose()
  }

  const getCurrentStepIndex = () => {
    return IMPORT_STEPS.findIndex(step => step.step === currentStep)
  }

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <div className="space-y-2">
          <p className="text-lg font-medium">
            {dragActive ? 'Drop your CSV file here' : 'Upload your contact list'}
          </p>
          <p className="text-gray-500">
            Drag and drop your CSV file, or click to browse
          </p>
        </div>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileInputChange}
          className="hidden"
          id="csv-upload"
        />
        <label htmlFor="csv-upload">
          <Button className="mt-4" asChild>
            <span>Choose File</span>
          </Button>
        </label>
      </div>

      {csvFile && (
        <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
          <FileText className="h-8 w-8 text-blue-500" />
          <div className="flex-1">
            <p className="font-medium">{csvFile.name}</p>
            <p className="text-sm text-gray-500">
              {(csvFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCsvFile(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">CSV Format Requirements</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• First row should contain column headers</li>
          <li>• Required fields: Email, First Name, Last Name</li>
          <li>• Maximum file size: 10MB</li>
          <li>• Supported formats: .csv files only</li>
        </ul>
      </div>
    </div>
  )

  const renderMappingStep = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium">CSV File: {csvFile?.name}</h4>
          <Badge variant="outline">
            {csvData?.totalRows} rows detected
          </Badge>
        </div>
        {csvData?.errors.length > 0 && (
          <p className="text-sm text-amber-600">
            {csvData.errors.length} parsing errors found
          </p>
        )}
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Map CSV columns to contact fields:</h4>
        
        {fieldMappings.map((mapping, index) => (
          <div key={mapping.contactField} className="flex items-center space-x-4 p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium">
                  {CSVParser['CONTACT_FIELDS'][mapping.contactField as keyof typeof CSVParser['CONTACT_FIELDS']]?.label}
                </span>
                {mapping.required && (
                  <Badge variant="destructive" className="text-xs">Required</Badge>
                )}
              </div>
            </div>
            
            <div className="flex-1">
              <select
                value={mapping.csvField}
                onChange={(e) => handleMappingChange(index, e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">-- Select CSV Column --</option>
                {csvData?.headers.map((header: string) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-8">
              {mapping.csvField ? (
                mapping.required ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                )
              ) : mapping.required ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : (
                <div className="h-5 w-5" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex space-x-3">
        <Button variant="outline" onClick={() => setCurrentStep('upload')}>
          Back
        </Button>
        <Button onClick={handlePreview}>
          Preview Data
        </Button>
      </div>
    </div>
  )

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Preview (showing first 10 rows)</h4>
        <Badge variant="outline">
          {previewData.filter(item => item.errors.length === 0).length} valid / {previewData.length} total
        </Badge>
      </div>

      <div className="max-h-96 overflow-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Company</th>
              <th className="p-2 text-left">Issues</th>
            </tr>
          </thead>
          <tbody>
            {previewData.map((item, index) => (
              <tr key={index} className="border-t">
                <td className="p-2">
                  {item.errors.length === 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                </td>
                <td className="p-2">{item.contact.email || '-'}</td>
                <td className="p-2">
                  {[item.contact.first_name, item.contact.last_name].filter(Boolean).join(' ') || '-'}
                </td>
                <td className="p-2">{item.contact.company_name || '-'}</td>
                <td className="p-2">
                  {item.errors.length > 0 && (
                    <span className="text-xs text-red-600">
                      {item.errors[0]}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex space-x-3">
        <Button variant="outline" onClick={() => setCurrentStep('mapping')}>
          Back to Mapping
        </Button>
        <Button onClick={handleImport} disabled={isProcessing}>
          Import Contacts
        </Button>
      </div>
    </div>
  )

  const renderProcessingStep = () => (
    <div className="text-center space-y-6">
      <div className="animate-spin mx-auto h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full" />
      <div>
        <h4 className="font-medium mb-2">Processing your contacts...</h4>
        <p className="text-gray-500">This may take a few moments</p>
      </div>
    </div>
  )

  const renderCompleteStep = () => (
    <div className="text-center space-y-6">
      <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
      
      <div>
        <h4 className="font-medium text-lg mb-2">Import Complete!</h4>
        <p className="text-gray-500">Your contacts have been successfully imported</p>
      </div>

      {importResult && (
        <div className="bg-gray-50 p-4 rounded-lg text-left">
          <h5 className="font-medium mb-2">Import Summary:</h5>
          <div className="space-y-1 text-sm">
            <p>✅ Created: {importResult.created} contacts</p>
            <p>⏭️ Skipped: {importResult.skipped} duplicates</p>
            {importResult.errors.length > 0 && (
              <p>❌ Errors: {importResult.errors.length} rows</p>
            )}
          </div>
        </div>
      )}

      <Button onClick={handleClose} className="w-full">
        Done
      </Button>
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center space-x-2 mb-6">
          {IMPORT_STEPS.map((step, index) => (
            <React.Fragment key={step.step}>
              <div className={`flex items-center space-x-2 ${
                index <= getCurrentStepIndex() ? 'text-blue-600' : 'text-gray-400'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index < getCurrentStepIndex() 
                    ? 'bg-blue-600 text-white' 
                    : index === getCurrentStepIndex()
                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-600'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {index < getCurrentStepIndex() ? '✓' : index + 1}
                </div>
                <span className="text-sm font-medium hidden sm:block">
                  {step.title}
                </span>
              </div>
              {index < IMPORT_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 ${
                  index < getCurrentStepIndex() ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {currentStep === 'upload' && renderUploadStep()}
          {currentStep === 'mapping' && renderMappingStep()}
          {currentStep === 'preview' && renderPreviewStep()}
          {currentStep === 'processing' && renderProcessingStep()}
          {currentStep === 'complete' && renderCompleteStep()}
        </div>
      </DialogContent>
    </Dialog>
  )
}