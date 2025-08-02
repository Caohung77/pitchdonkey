'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, AlertCircle, FileText } from 'lucide-react'

interface ContactImportDialogProps {
  onImportComplete: () => void
}

function ContactImportDialog({ onImportComplete }: ContactImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        setError('Please select a CSV file')
        return
      }
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size must be less than 10MB')
        return
      }
      setFile(selectedFile)
      setError('')
    }
  }

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file')
      return
    }

    setIsUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setOpen(false)
        setFile(null)
        onImportComplete()
        alert(`Successfully imported ${data.imported || 0} contacts!`)
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Import failed')
      }
    } catch (error) {
      console.error('Error importing contacts:', error)
      setError(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="mt-1"
            />
          </div>

          {file && (
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <FileText className="h-6 w-6 text-blue-500" />
              <div className="flex-1">
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
          )}

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">CSV Format Requirements</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• First row should contain column headers</li>
              <li>• Required columns: email, first_name, last_name</li>
              <li>• Optional columns: company, position, phone</li>
              <li>• Maximum file size: 10MB</li>
            </ul>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || isUploading}
            >
              {isUploading ? 'Importing...' : 'Import Contacts'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ContactImportDialog