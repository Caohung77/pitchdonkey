// Script to populate Supabase with 100 mock contacts
// Run with: node populate-contacts.js

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const userId = '2c65715b-43fa-4cc4-8a29-4cec419cb9f1' // Your user ID

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Mock data arrays
const firstNames = [
  'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Maria',
  'William', 'Jennifer', 'Richard', 'Linda', 'Charles', 'Patricia', 'Joseph', 'Barbara', 'Thomas', 'Elizabeth',
  'Christopher', 'Susan', 'Daniel', 'Jessica', 'Matthew', 'Karen', 'Anthony', 'Nancy', 'Mark', 'Betty',
  'Donald', 'Helen', 'Steven', 'Sandra', 'Paul', 'Donna', 'Andrew', 'Carol', 'Joshua', 'Ruth',
  'Kenneth', 'Sharon', 'Kevin', 'Michelle', 'Brian', 'Laura', 'George', 'Sarah', 'Edward', 'Kimberly'
]

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
]

const companies = [
  'TechCorp Solutions', 'InnovateLab', 'DataDrive Inc', 'CloudFirst Technologies', 'NextGen Systems',
  'Digital Dynamics', 'SmartFlow Solutions', 'FutureTech Enterprises', 'CodeCraft Studios', 'ByteForge',
  'PixelPerfect Design', 'WebWorks Agency', 'AppMaster Solutions', 'DevOps Dynamics', 'CyberSecure Systems',
  'AI Innovations', 'BlockChain Builders', 'QuantumLeap Technologies', 'RoboTech Industries', 'VirtualReality Labs',
  'GreenTech Solutions', 'HealthTech Innovations', 'FinTech Forward', 'EduTech Systems', 'RetailTech Solutions',
  'LogisticsPro', 'ManufacturingMax', 'ConstructionCore', 'EnergyEfficient Inc', 'TransportTech',
  'FoodTech Innovations', 'AgriTech Solutions', 'BioTech Labs', 'PharmaTech Inc', 'MedDevice Solutions',
  'ConsultingPro', 'MarketingMasters', 'SalesForce Solutions', 'CustomerFirst Inc', 'BrandBuilders',
  'Creative Collective', 'Design Studio Pro', 'Content Creators Inc', 'Media Mavens', 'Publishing Plus',
  'Legal Eagles', 'AccountingAce', 'HR Solutions', 'Talent Acquisition Inc', 'Recruitment Pros'
]

const jobTitles = [
  'CEO', 'CTO', 'CFO', 'COO', 'VP of Engineering', 'VP of Sales', 'VP of Marketing', 'Director of Operations',
  'Engineering Manager', 'Product Manager', 'Project Manager', 'Sales Manager', 'Marketing Manager', 'HR Manager',
  'Software Engineer', 'Senior Developer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer',
  'DevOps Engineer', 'Data Scientist', 'Data Analyst', 'UX Designer', 'UI Designer', 'Graphic Designer',
  'Sales Representative', 'Account Executive', 'Business Development Manager', 'Customer Success Manager',
  'Marketing Specialist', 'Content Manager', 'Social Media Manager', 'SEO Specialist', 'Digital Marketer',
  'Operations Manager', 'Supply Chain Manager', 'Quality Assurance Manager', 'IT Manager', 'Security Analyst',
  'Financial Analyst', 'Accountant', 'Legal Counsel', 'Recruiter', 'Training Manager', 'Consultant',
  'Business Analyst', 'Systems Administrator', 'Network Engineer', 'Database Administrator', 'Technical Writer'
]

const cities = [
  'San Francisco', 'New York', 'Los Angeles', 'Chicago', 'Boston', 'Seattle', 'Austin', 'Denver',
  'Atlanta', 'Miami', 'Dallas', 'Phoenix', 'Portland', 'San Diego', 'Las Vegas', 'Detroit',
  'Philadelphia', 'Houston', 'Minneapolis', 'Nashville', 'Charlotte', 'Tampa', 'Orlando', 'Pittsburgh',
  'London', 'Berlin', 'Paris', 'Amsterdam', 'Barcelona', 'Milan', 'Stockholm', 'Copenhagen',
  'Toronto', 'Vancouver', 'Montreal', 'Sydney', 'Melbourne', 'Singapore', 'Tokyo', 'Hong Kong'
]

const countries = [
  'United States', 'United Kingdom', 'Germany', 'France', 'Netherlands', 'Spain', 'Italy', 'Sweden',
  'Denmark', 'Canada', 'Australia', 'Singapore', 'Japan', 'Hong Kong'
]

const industries = [
  'technology', 'finance', 'healthcare', 'education', 'retail', 'manufacturing', 'consulting',
  'marketing', 'media', 'legal', 'real-estate', 'automotive', 'aerospace', 'energy'
]

const statuses = ['active', 'active', 'active', 'active', 'active', 'active', 'unsubscribed', 'bounced']

const tags = [
  'hot-lead', 'cold-lead', 'decision-maker', 'influencer', 'technical', 'budget-holder',
  'early-adopter', 'enterprise', 'startup', 'mid-market', 'high-priority', 'follow-up'
]

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)]
}

function getRandomItems(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

function generateEmail(firstName, lastName, company) {
  const domain = company.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10) + '.com'
  
  const emailFormats = [
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase()}@${domain}`,
    `${firstName.toLowerCase()}@${domain}`,
    `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}@${domain}`
  ]
  
  return getRandomItem(emailFormats)
}

function generatePhone() {
  const areaCode = Math.floor(Math.random() * 900) + 100
  const exchange = Math.floor(Math.random() * 900) + 100
  const number = Math.floor(Math.random() * 9000) + 1000
  return `+1-${areaCode}-${exchange}-${number}`
}

function generateLinkedIn(firstName, lastName) {
  return `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${Math.floor(Math.random() * 999)}`
}

function generateWebsite(company) {
  return `https://${company.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15)}.com`
}

function getRandomDate(daysAgo) {
  const date = new Date()
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo))
  return date.toISOString()
}

async function generateContacts() {
  console.log('🚀 Generating 100 mock contacts...\n')
  
  const contacts = []
  
  for (let i = 0; i < 100; i++) {
    const firstName = getRandomItem(firstNames)
    const lastName = getRandomItem(lastNames)
    const company = getRandomItem(companies)
    const city = getRandomItem(cities)
    const country = getRandomItem(countries)
    const industry = getRandomItem(industries)
    const status = getRandomItem(statuses)
    
    const contact = {
      user_id: userId,
      email: generateEmail(firstName, lastName, company),
      first_name: firstName,
      last_name: lastName,
      company: company,
      position: getRandomItem(jobTitles),
      phone: Math.random() > 0.3 ? generatePhone() : null,
      website: Math.random() > 0.5 ? generateWebsite(company) : null,
      linkedin_url: Math.random() > 0.4 ? generateLinkedIn(firstName, lastName) : null,
      twitter_url: Math.random() > 0.8 ? `https://twitter.com/${firstName.toLowerCase()}${lastName.toLowerCase()}` : null,
      country: country,
      city: city,
      timezone: 'America/New_York', // Simplified for now
      custom_fields: {
        industry: industry,
        company_size: getRandomItem(['1-10', '11-50', '51-200', '201-1000', '1000+']),
        lead_source: getRandomItem(['website', 'linkedin', 'referral', 'cold-email', 'event']),
        budget: getRandomItem(['< $10k', '$10k-50k', '$50k-100k', '$100k+'])
      },
      tags: getRandomItems(tags, Math.floor(Math.random() * 3) + 1),
      segments: [], // Will be populated by segment logic
      status: status,
      unsubscribed_at: status === 'unsubscribed' ? getRandomDate(30) : null,
      last_contacted_at: status === 'active' && Math.random() > 0.5 ? getRandomDate(60) : null,
      last_opened_at: Math.random() > 0.6 ? getRandomDate(30) : null,
      last_clicked_at: Math.random() > 0.8 ? getRandomDate(30) : null,
      last_replied_at: status === 'active' && Math.random() > 0.7 ? getRandomDate(45) : null,
      ai_research_data: {
        company_description: `${company} is a leading company in the ${industry} industry.`,
        recent_news: `Recent expansion in ${city} market.`,
        social_activity: Math.floor(Math.random() * 100),
        engagement_score: Math.floor(Math.random() * 100)
      },
      ai_personalization_score: Math.random() * 9.99,
      created_at: getRandomDate(90),
      updated_at: getRandomDate(30)
    }
    
    contacts.push(contact)
    
    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`✅ Generated ${i + 1}/100 contacts`)
    }
  }
  
  return contacts
}

async function insertContacts() {
  try {
    console.log('\n📊 Checking existing contacts...')
    
    // Check if contacts already exist
    const { data: existingContacts, error: checkError } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
    
    if (checkError) {
      console.error('❌ Error checking existing contacts:', checkError)
      return
    }
    
    if (existingContacts && existingContacts.length > 0) {
      console.log(`⚠️  Found ${existingContacts.length} existing contacts`)
      console.log('🗑️  Clearing existing contacts first...')
      
      const { error: deleteError } = await supabase
        .from('contacts')
        .delete()
        .eq('user_id', userId)
      
      if (deleteError) {
        console.error('❌ Error deleting existing contacts:', deleteError)
        return
      }
      
      console.log('✅ Existing contacts cleared')
    }
    
    console.log('\n🎯 Generating fresh contact data...')
    const contacts = await generateContacts()
    
    console.log('\n💾 Inserting contacts into database...')
    
    // Insert in batches of 10 to avoid timeout
    const batchSize = 10
    let inserted = 0
    
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize)
      
      const { data, error } = await supabase
        .from('contacts')
        .insert(batch)
        .select('id')
      
      if (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, error)
        continue
      }
      
      inserted += batch.length
      console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}: ${inserted}/${contacts.length} contacts`)
    }
    
    console.log(`\n🎉 Successfully populated database with ${inserted} contacts!`)
    
    // Show some statistics
    console.log('\n📈 Contact Statistics:')
    
    const { data: stats } = await supabase
      .from('contacts')
      .select('status, custom_fields, country')
      .eq('user_id', userId)
    
    if (stats) {
      const statusCounts = {}
      const industryCounts = {}
      const countryCounts = {}
      
      stats.forEach(contact => {
        statusCounts[contact.status] = (statusCounts[contact.status] || 0) + 1
        if (contact.custom_fields?.industry) {
          industryCounts[contact.custom_fields.industry] = (industryCounts[contact.custom_fields.industry] || 0) + 1
        }
        countryCounts[contact.country] = (countryCounts[contact.country] || 0) + 1
      })
      
      console.log('\n📊 By Status:')
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`)
      })
      
      console.log('\n🏭 By Industry:')
      Object.entries(industryCounts).slice(0, 5).forEach(([industry, count]) => {
        console.log(`  ${industry}: ${count}`)
      })
      
      console.log('\n🌍 By Country:')
      Object.entries(countryCounts).slice(0, 5).forEach(([country, count]) => {
        console.log(`  ${country}: ${count}`)
      })
    }
    
    console.log('\n🎯 Ready for segmentation!')
    console.log('You can now create segments based on:')
    console.log('- Industry (technology, finance, healthcare, etc.)')
    console.log('- Job titles (CEO, Manager, Developer, etc.)')
    console.log('- Location (San Francisco, New York, London, etc.)')
    console.log('- Company size (1-10, 11-50, 51-200, etc.)')
    console.log('- Status (active, contacted, replied, etc.)')
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the script
insertContacts()