import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { ContactService } from '@/lib/contacts'
import { CSVParser } from '@/lib/csv-parser'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const mappingsJson = formData.get('mappings') as string
    const options = formData.get('options') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Only CSV files are supported' },
        { status: 400 }
      )
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    // Parse CSV content
    const csvContent = await file.text()
    const delimiter = CSVParser.detectDelimiter(csvContent)
    const parseResult = CSVParser.parseCSV(csvContent, { 
      delimiter,
      maxRows: 10000 // Limit to prevent memory issues
    })

    if (parseResult.errors.length > 0 && parseResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to parse CSV file. Please check the format.' },
        { status: 400 }
      )
    }

    // Parse field mappings if provided
    let fieldMappings = []
    if (mappingsJson) {
      try {
        fieldMappings = JSON.parse(mappingsJson)
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid field mappings format' },
          { status: 400 }
        )
      }
    } else {
      // Auto-detect field mappings
      fieldMappings = CSVParser.detectFieldMappings(parseResult.headers)
    }

    // Validate field mappings
    const mappingErrors = CSVParser.validateFieldMappings(fieldMappings)
    if (mappingErrors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Invalid field mappings',
          details: mappingErrors
        },
        { status: 400 }
      )
    }

    // Transform CSV rows to contacts
    const transformResults = CSVParser.transformRowsToContacts(parseResult.rows, fieldMappings)
    
    // Parse import options
    let importOptions = {
      skipDuplicates: true,
      validateEmails: true,
      importInvalidContacts: false
    }
    
    if (options) {
      try {
        importOptions = { ...importOptions, ...JSON.parse(options) }
      } catch (error) {
        // Use default options if parsing fails
      }
    }

    // Filter contacts based on options
    let contactsToImport = transformResults
    if (!importOptions.importInvalidContacts) {
      contactsToImport = transformResults.filter(result => result.errors.length === 0)
    }

    const validContacts = contactsToImport.map(result => result.contact)

    // Import contacts using the ContactService
    const contactService = new ContactService()
    const importResult = await contactService.bulkCreateContacts(
      user.id,
      validContacts,
      {
        skipDuplicates: importOptions.skipDuplicates,
        validateEmails: importOptions.validateEmails
      }
    )

    // Combine results with transformation errors
    const transformErrors = transformResults
      .filter(result => result.errors.length > 0)
      .map(result => ({
        row: result.rowIndex + 2, // +2 because CSV is 1-indexed and has header
        error: result.errors.join(', '),
        data: result.contact
      }))

    const finalResult = {
      ...importResult,
      errors: [...importResult.errors, ...transformErrors],
      processingStats: {
        totalRows: parseResult.totalRows,
        validRows: transformResults.filter(r => r.errors.length === 0).length,
        invalidRows: transformResults.filter(r => r.errors.length > 0).length,
        parseErrors: parseResult.errors.length
      }
    }

    return NextResponse.json({
      success: true,
      data: finalResult
    })

  } catch (error) {
    console.error('CSV import error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle CSV preview without importing
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Only CSV files are supported' },
        { status: 400 }
      )
    }

    // Parse CSV content for preview
    const csvContent = await file.text()
    const delimiter = CSVParser.detectDelimiter(csvContent)
    const parseResult = CSVParser.parseCSV(csvContent, { 
      delimiter,
      maxRows: 100 // Limit for preview
    })

    if (parseResult.errors.length > 0 && parseResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to parse CSV file. Please check the format.' },
        { status: 400 }
      )
    }

    // Auto-detect field mappings
    const fieldMappings = CSVParser.detectFieldMappings(parseResult.headers)
    
    // Get sample data for preview
    const sampleData = CSVParser.getSampleData(parseResult.rows, 10)
    
    // Transform sample data to show preview
    const previewResults = CSVParser.transformRowsToContacts(sampleData, fieldMappings)
    
    return NextResponse.json({
      success: true,
      data: {
        headers: parseResult.headers,
        sampleRows: sampleData,
        fieldMappings,
        previewContacts: previewResults,
        totalRows: parseResult.totalRows,
        parseErrors: parseResult.errors,
        detectedDelimiter: delimiter
      }
    })

  } catch (error) {
    console.error('CSV preview error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}