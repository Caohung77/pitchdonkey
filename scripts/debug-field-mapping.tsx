// Debug script to test the field mapping issue
// This shows what options should be available in the dropdown

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
  'source': { label: 'Source', required: false }
}

console.log('Available field options:')
Object.entries(CONTACT_FIELD_OPTIONS).forEach(([key, config]) => {
  console.log(`${key}: ${config.label} (required: ${config.required})`)
})

// Expected mapping for German fields:
console.log('\nExpected mappings for German CSV:')
console.log('VORNAME → first_name (First Name)')
console.log('NACHNAME → last_name (Last Name)')
console.log('EMAIL → email (Email Address)')
console.log('COMPANY → company (Company Name)')
console.log('TITLE → position (Position/Job Title)')
console.log('SOURCE → source (Source)')

export {}