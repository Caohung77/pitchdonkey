'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Info } from 'lucide-react'

interface FieldMapping {
  csvField: string
  contactField: string
  required: boolean
  example?: string
  confidence?: number
}

interface FieldMappingPreviewProps {
  headers: string[]
  sampleRows: Record<string, string>[]
  fieldMappings: FieldMapping[]
  onMappingChange: (csvField: string, contactField: string) => void
  errors: string[]
}

const CONTACT_FIELD_OPTIONS = {
  '__skip__': { label: 'Skip Field', required: false },
  'email': { label: 'Email Address', required: true },
  'first_name': { label: 'First Name', required: false },
  'last_name': { label: 'Last Name', required: false },
  'company': { label: 'Company Name', required: false },
  'position': { label: 'Position/Job Title', required: false },
  'website': { label: 'Website URL', required: false },
  'phone': { label: 'Phone Number', required: false },
  'linkedin_url': { label: 'LinkedIn URL', required: false },
  'twitter_url': { label: 'Twitter URL', required: false },
  'address': { label: 'Address', required: false },
  'postcode': { label: 'Postcode/Zip Code', required: false },
  'country': { label: 'Country', required: false },
  'city': { label: 'City', required: false },
  'timezone': { label: 'Timezone', required: false },
  'sex': { label: 'Sex/Gender', required: false },
  'source': { label: 'Source', required: false }
}

export function FieldMappingPreview({
  headers,
  sampleRows,
  fieldMappings,
  onMappingChange,
  errors
}: FieldMappingPreviewProps) {
  // Create lookup for current mappings
  const mappingLookup = new Map<string, string>()
  fieldMappings.forEach(mapping => {
    if (mapping.csvField) {
      mappingLookup.set(mapping.csvField, mapping.contactField)
    }
  })

  // Check for validation issues
  const requiredFields = Object.entries(CONTACT_FIELD_OPTIONS)
    .filter(([, config]) => config.required)
    .map(([field]) => field)

  const mappedRequiredFields = new Set(
    fieldMappings
      .filter(m => m.csvField && m.csvField !== '__skip__' && requiredFields.includes(m.contactField))
      .map(m => m.contactField)
  )

  const missingRequiredFields = requiredFields.filter(field => !mappedRequiredFields.has(field))

  // Check for duplicate mappings
  const usedContactFields = new Map<string, string[]>()
  fieldMappings.forEach(mapping => {
    if (mapping.csvField && mapping.csvField !== '__skip__' && mapping.contactField) {
      const existing = usedContactFields.get(mapping.contactField) || []
      existing.push(mapping.csvField)
      usedContactFields.set(mapping.contactField, existing)
    }
  })

  const duplicateFields = Array.from(usedContactFields.entries())
    .filter(([, csvFields]) => csvFields.length > 1)

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return null
    
    if (confidence >= 0.9) {
      return <Badge variant="default" className="bg-green-100 text-green-800">High Confidence</Badge>
    } else if (confidence >= 0.7) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Medium Confidence</Badge>
    } else {
      return <Badge variant="outline" className="bg-red-100 text-red-800">Low Confidence</Badge>
    }
  }

  const getSampleValue = (csvField: string) => {
    const sampleRow = sampleRows.find(row => row[csvField] && row[csvField].trim())
    return sampleRow ? sampleRow[csvField] : 'No data'
  }

  return (
    <div className="space-y-6">
      {/* Validation Alerts */}
      {(errors.length > 0 || missingRequiredFields.length > 0 || duplicateFields.length > 0) && (
        <div className="space-y-2">
          {missingRequiredFields.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 text-red-600 mr-2 mt-0.5" />
                <div>
                  <span className="text-red-800 text-sm font-medium">Missing Required Fields:</span>
                  <div className="text-red-700 text-sm mt-1">
                    {missingRequiredFields.map(field => 
                      CONTACT_FIELD_OPTIONS[field as keyof typeof CONTACT_FIELD_OPTIONS]?.label
                    ).join(', ')}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {duplicateFields.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 text-yellow-600 mr-2 mt-0.5" />
                <div>
                  <span className="text-yellow-800 text-sm font-medium">Duplicate Mappings:</span>
                  <div className="text-yellow-700 text-sm mt-1">
                    {duplicateFields.map(([contactField, csvFields]) => 
                      `${CONTACT_FIELD_OPTIONS[contactField as keyof typeof CONTACT_FIELD_OPTIONS]?.label} is mapped from: ${csvFields.join(', ')}`
                    ).join('. ')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {errors.map((error, index) => (
            <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                <span className="text-red-800 text-sm">{error}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mapping Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Import Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{headers.length}</div>
              <div className="text-gray-600">CSV Columns</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {fieldMappings.filter(m => m.csvField && m.csvField !== '__skip__' && m.contactField).length}
              </div>
              <div className="text-gray-600">Mapped Fields</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {headers.length - fieldMappings.filter(m => m.csvField && m.csvField !== '__skip__' && m.contactField).length}
              </div>
              <div className="text-gray-600">Custom Fields</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{sampleRows.length}</div>
              <div className="text-gray-600">Sample Rows</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Field Mapping Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Field Mapping Configuration</CardTitle>
          <p className="text-sm text-gray-600">
            Map your CSV columns to contact fields. Unmapped columns will be saved as custom fields.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {headers.map((header, index) => {
              const currentMapping = mappingLookup.get(header) || ''
              const mappingInfo = fieldMappings.find(m => m.csvField === header)
              const sampleValue = getSampleValue(header)
              
              return (
                <div key={index} className="flex items-center space-x-4 p-3 border rounded-lg">
                  {/* CSV Field Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{header}</span>
                      {mappingInfo?.confidence && getConfidenceBadge(mappingInfo.confidence)}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      Sample: <span className="italic">"{sampleValue}"</span>
                    </div>
                  </div>

                  {/* Mapping Arrow */}
                  <div className="text-gray-400">→</div>

                  {/* Contact Field Selection */}
                  <div className="w-64">
                    <Select
                      value={currentMapping || ""}
                      onValueChange={(value) => {
                        console.log(`Mapping ${header} to ${value}`)
                        onMappingChange(header, value)
                      }}
                    >
                      <SelectTrigger className="border-2">
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        {Object.entries(CONTACT_FIELD_OPTIONS).map(([value, config]) => {
                          // Check if this field is already mapped to prevent duplicates
                          const isAlreadyMapped = Array.from(mappingLookup.values()).includes(value) && mappingLookup.get(header) !== value
                          
                          return (
                            <SelectItem 
                              key={value} 
                              value={value}
                              disabled={isAlreadyMapped && value !== '__skip__'}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className={isAlreadyMapped ? 'text-gray-400' : ''}>
                                  {config.label}
                                  {isAlreadyMapped && ' (Already mapped)'}
                                </span>
                                {config.required && (
                                  <Badge variant="outline" className="ml-2 text-xs">Required</Badge>
                                )}
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Indicator */}
                  <div className="w-6">
                    {currentMapping && currentMapping !== '__skip__' && CONTACT_FIELD_OPTIONS[currentMapping as keyof typeof CONTACT_FIELD_OPTIONS] ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : currentMapping === '__skip__' ? (
                      <Info className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Info className="h-5 w-5 text-blue-500" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Preview of Transformed Data */}
      {sampleRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Preview</CardTitle>
            <p className="text-sm text-gray-600">
              Preview of how your data will be imported with current mappings
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    {Object.entries(CONTACT_FIELD_OPTIONS)
                      .filter(([field]) => field && field !== '__skip__' && fieldMappings.some(m => m.contactField === field && m.csvField && m.csvField !== '__skip__'))
                      .map(([field, config]) => (
                        <th key={field} className="text-left p-2 font-medium">
                          {config.label}
                          {config.required && <span className="text-red-500 ml-1">*</span>}
                        </th>
                      ))}
                    <th className="text-left p-2 font-medium">Custom Fields</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.slice(0, 3).map((row, index) => {
                    const mappedData: Record<string, string> = {}
                    const customFields: Record<string, string> = {}
                    
                    Object.entries(row).forEach(([csvField, value]) => {
                      const contactField = mappingLookup.get(csvField)
                      if (contactField && contactField.trim() && contactField !== '__skip__') {
                        mappedData[contactField] = value
                      } else if (value && value.trim() && contactField !== '__skip__') {
                        customFields[csvField] = value
                      }
                    })
                    
                    return (
                      <tr key={index} className="border-b">
                        {Object.entries(CONTACT_FIELD_OPTIONS)
                          .filter(([field]) => field && field !== '__skip__' && fieldMappings.some(m => m.contactField === field && m.csvField && m.csvField !== '__skip__'))
                          .map(([field]) => (
                            <td key={field} className="p-2 text-gray-700">
                              {mappedData[field] || '-'}
                            </td>
                          ))}
                        <td className="p-2 text-gray-700">
                          {Object.keys(customFields).length > 0 ? (
                            <div className="text-xs">
                              {Object.entries(customFields).slice(0, 2).map(([key, value]) => (
                                <div key={key}>{key}: {value}</div>
                              ))}
                              {Object.keys(customFields).length > 2 && (
                                <div className="text-gray-500">+{Object.keys(customFields).length - 2} more</div>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            
            {sampleRows.length > 3 && (
              <div className="text-sm text-gray-500 text-center mt-3">
                ... and {sampleRows.length - 3} more rows
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}