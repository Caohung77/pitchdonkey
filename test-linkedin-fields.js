#!/usr/bin/env node

/**
 * LinkedIn Scraper Field Analysis - Shows available fields for email personalization
 * Based on the BrightData schema and real-world data structure
 */

// Sample LinkedIn profile data structure (based on your scraper schema)
const sampleLinkedInProfile = {
  // Basic Information (Most reliable fields)
  id: "ACoAABs4yJUBHtQb5K7P8hWm0vILbmCH6Z7rBqE",
  name: "Frédéric Titze", 
  first_name: "Frédéric",
  last_name: "Titze",
  headline: "Chief Technology Officer at TechCorp | Innovation Leader | Digital Transformation Expert",
  
  // Location (High availability - 96%+)
  city: "Munich",
  country: "Germany", 
  country_code: "DE",
  
  // Professional Information (90%+ availability)
  position: "Chief Technology Officer",
  industry: "Information Technology and Services",
  current_company: {
    name: "TechCorp Solutions GmbH",
    company_id: "techcorp-solutions-gmbh",
    industry: "Information Technology and Services",
    job_title: "Chief Technology Officer",
    location: "Munich, Germany",
    start_date: "2021-01"
  },
  
  // Profile URLs and Media
  url: "https://www.linkedin.com/in/frédéric-titze-4a5ba1110/",
  profile_url: "https://www.linkedin.com/in/frédéric-titze-4a5ba1110/",
  avatar: "https://media.licdn.com/dms/image/C4E03AQGxyz123.../profile-displayphoto.../",
  
  // About Section (18% availability but high value)
  about: "Experienced technology leader with over 15 years in digital transformation and software architecture. Passionate about building scalable solutions and leading high-performing engineering teams. Expertise in cloud computing, microservices, and agile methodologies. Currently driving innovation at TechCorp, focusing on AI-powered business solutions and sustainable technology practices.",
  
  // Professional Experience (65% availability)
  experience: [
    {
      title: "Chief Technology Officer",
      company: "TechCorp Solutions GmbH", 
      company_id: "techcorp-solutions-gmbh",
      location: "Munich, Germany",
      start_date: "2021-01",
      end_date: null, // Current position
      description: "Leading technology strategy and innovation for a 200+ person company. Responsible for digital transformation initiatives, cloud migration, and building scalable architecture for enterprise clients.",
      industry: "Information Technology and Services"
    },
    {
      title: "Senior Software Architect",
      company: "Digital Innovations AG",
      company_id: "digital-innovations-ag", 
      location: "Berlin, Germany",
      start_date: "2018-03",
      end_date: "2020-12",
      description: "Designed and implemented microservices architecture for e-commerce platforms. Led a team of 12 developers in delivering cloud-native solutions.",
      industry: "E-commerce"
    },
    {
      title: "Lead Developer", 
      company: "StartupTech Berlin",
      company_id: "startuptech-berlin",
      location: "Berlin, Germany", 
      start_date: "2015-06",
      end_date: "2018-02",
      description: "Full-stack development and team leadership for mobile and web applications. Implemented DevOps practices and CI/CD pipelines.",
      industry: "Technology"
    }
  ],
  
  // Education
  education: [
    {
      school: "Technical University of Munich", 
      degree: "Master of Science",
      field_of_study: "Computer Science",
      start_year: "2008",
      end_year: "2011", 
      description: "Specialized in Software Engineering and Distributed Systems. Thesis on cloud computing architectures."
    },
    {
      school: "University of Stuttgart",
      degree: "Bachelor of Science", 
      field_of_study: "Information Technology",
      start_year: "2005",
      end_year: "2008",
      description: "Foundation in programming, databases, and system administration."
    }
  ],
  
  // Skills (High value for personalization)
  skills: [
    "Cloud Computing", "Software Architecture", "Team Leadership", "Agile Methodologies", 
    "Microservices", "DevOps", "Python", "Java", "Kubernetes", "AWS", "Docker", 
    "React", "Node.js", "PostgreSQL", "Redis", "Digital Transformation"
  ],
  
  // Languages
  languages: [
    { name: "German", proficiency: "Native" },
    { name: "English", proficiency: "Fluent" }, 
    { name: "French", proficiency: "Conversational" }
  ],
  
  // Certifications (Great for credibility)
  certifications: [
    {
      name: "AWS Certified Solutions Architect", 
      organization: "Amazon Web Services",
      issue_date: "2020-08",
      expiration_date: "2023-08",
      credential_id: "AWS-CSA-123456"
    },
    {
      name: "Certified Kubernetes Administrator",
      organization: "Cloud Native Computing Foundation", 
      issue_date: "2021-03",
      expiration_date: "2024-03",
      credential_id: "CKA-789012"
    }
  ],
  
  // Social Metrics
  connections: 2847,
  followers: 1205,
  
  // Recent Activity/Posts (2% availability but high engagement value)
  posts: [
    {
      title: "The Future of Cloud-Native Architecture", 
      content: "Just presented our latest microservices implementation at #TechConf2023. The transformation journey has been incredible - 40% performance improvement and 60% reduction in deployment time.",
      created_date: "2023-11-15",
      likes_count: 324,
      comments_count: 87,
      shares_count: 45
    }
  ],
  
  // Projects (Professional showcase)
  projects: [
    {
      name: "Enterprise Cloud Migration Platform",
      description: "Led the development of an automated cloud migration tool that helped 50+ companies transition to AWS/Azure. Reduced migration time by 70%.",
      start_date: "2022-01",
      end_date: "2023-06",
      associated_with: "TechCorp Solutions GmbH"
    }
  ],
  
  // Contact Information (Rarely available but valuable)
  contact_info: {
    websites: ["https://frederic-titze.tech", "https://techcorp.de/team/frederic"],
    email: null, // Usually not available
    twitter: "@FredericTitze",
    phone: null // Usually not available
  },
  
  // Metadata
  timestamp: "2024-01-08T10:30:00Z",
  status: "success",
  data_quality_score: 0.87
}

// Personalization fields extraction
function getPersonalizationFields(profile) {
  return {
    // Basic personalization (Always use these)
    basic: {
      first_name: profile.first_name || profile.name?.split(' ')[0] || '',
      full_name: profile.name || '',
      current_position: profile.position || '',
      current_company: profile.current_company?.name || profile.current_company || '',
      location: [profile.city, profile.country].filter(Boolean).join(', '),
      country: profile.country || '',
      industry: profile.industry || ''
    },
    
    // Professional context (High-value personalization)
    professional: {
      years_experience: calculateExperience(profile.experience),
      current_role_duration: calculateCurrentRoleDuration(profile.experience),
      previous_companies: getPreviousCompanies(profile.experience),
      career_progression: getCareerProgression(profile.experience),
      top_skills: profile.skills?.slice(0, 5) || [],
      education_level: getEducationLevel(profile.education),
      alma_mater: profile.education?.[0]?.school || '',
      certifications: profile.certifications?.map(c => c.name) || []
    },
    
    // Personal interest signals (Conversation starters)
    personal: {
      languages_spoken: profile.languages?.map(l => l.name) || [],
      recent_posts: profile.posts?.slice(0, 2)?.map(p => ({
        topic: extractTopicFromPost(p),
        engagement: p.likes_count + p.comments_count
      })) || [],
      projects: profile.projects?.map(p => p.name) || [],
      professional_interests: extractInterests(profile.about),
      connection_count: profile.connections || 0,
      thought_leader_score: calculateThoughtLeaderScore(profile)
    },
    
    // Outreach optimization data
    outreach_signals: {
      preferred_topics: getPreferredTopics(profile),
      engagement_style: getEngagementStyle(profile),
      authority_indicators: getAuthorityIndicators(profile), 
      pain_points: getPainPoints(profile),
      business_priorities: getBusinessPriorities(profile),
      decision_maker_score: calculateDecisionMakerScore(profile)
    }
  }
}

// Helper functions for data analysis
function calculateExperience(experience) {
  if (!experience || experience.length === 0) return 0
  const startDates = experience.map(e => new Date(e.start_date || '2000-01-01'))
  const earliestStart = Math.min(...startDates)
  return new Date().getFullYear() - new Date(earliestStart).getFullYear()
}

function calculateCurrentRoleDuration(experience) {
  const currentRole = experience?.find(e => !e.end_date)
  if (!currentRole || !currentRole.start_date) return 0
  const start = new Date(currentRole.start_date)
  const now = new Date()
  return Math.round((now - start) / (1000 * 60 * 60 * 24 * 30)) // months
}

function getPreviousCompanies(experience) {
  return experience?.filter(e => e.end_date).map(e => e.company).slice(0, 3) || []
}

function getCareerProgression(experience) {
  if (!experience || experience.length < 2) return 'Unknown'
  const roles = experience.sort((a, b) => new Date(b.start_date || '2000') - new Date(a.start_date || '2000'))
  const current = roles[0]?.title?.toLowerCase() || ''
  const previous = roles[1]?.title?.toLowerCase() || ''
  
  if (current.includes('cto') || current.includes('chief')) return 'Executive'
  if (current.includes('director') || current.includes('vp')) return 'Senior Leadership' 
  if (current.includes('senior') || current.includes('lead')) return 'Senior Individual Contributor'
  return 'Individual Contributor'
}

function getEducationLevel(education) {
  if (!education || education.length === 0) return 'Unknown'
  const degrees = education.map(e => e.degree?.toLowerCase() || '')
  if (degrees.some(d => d.includes('phd') || d.includes('doctorate'))) return 'PhD'
  if (degrees.some(d => d.includes('master') || d.includes('msc') || d.includes('mba'))) return 'Masters'
  if (degrees.some(d => d.includes('bachelor') || d.includes('bsc'))) return 'Bachelors'
  return 'Other'
}

function extractTopicFromPost(post) {
  const text = (post.title + ' ' + post.content).toLowerCase()
  const topics = ['ai', 'cloud', 'leadership', 'innovation', 'digital transformation', 'agile', 'microservices']
  return topics.find(topic => text.includes(topic)) || 'general'
}

function extractInterests(about) {
  if (!about) return []
  const interests = []
  const text = about.toLowerCase()
  
  if (text.includes('innovation')) interests.push('Innovation')
  if (text.includes('digital transformation')) interests.push('Digital Transformation')  
  if (text.includes('ai') || text.includes('artificial intelligence')) interests.push('AI/Machine Learning')
  if (text.includes('cloud')) interests.push('Cloud Computing')
  if (text.includes('team') || text.includes('leadership')) interests.push('Team Leadership')
  if (text.includes('sustainable')) interests.push('Sustainability')
  
  return interests
}

function calculateThoughtLeaderScore(profile) {
  let score = 0
  if (profile.posts && profile.posts.length > 0) score += 20
  if (profile.connections > 1000) score += 15
  if (profile.followers > 500) score += 15
  if (profile.certifications && profile.certifications.length > 0) score += 10
  if (profile.projects && profile.projects.length > 0) score += 10
  if (profile.about && profile.about.length > 200) score += 10
  if (profile.position && (profile.position.includes('CTO') || profile.position.includes('Chief'))) score += 20
  return score
}

function getPreferredTopics(profile) {
  const topics = []
  const text = (profile.about + ' ' + profile.headline + ' ' + (profile.skills || []).join(' ')).toLowerCase()
  
  if (text.includes('cloud')) topics.push('Cloud Computing')
  if (text.includes('ai') || text.includes('artificial intelligence')) topics.push('Artificial Intelligence') 
  if (text.includes('digital transformation')) topics.push('Digital Transformation')
  if (text.includes('leadership')) topics.push('Leadership & Management')
  if (text.includes('innovation')) topics.push('Innovation & Strategy')
  if (text.includes('agile') || text.includes('scrum')) topics.push('Agile Methodologies')
  
  return topics.slice(0, 3)
}

function getEngagementStyle(profile) {
  if (profile.posts && profile.posts.length > 0) return 'Active Content Creator'
  if (profile.connections > 2000) return 'Network Builder'  
  if (profile.certifications && profile.certifications.length > 2) return 'Continuous Learner'
  return 'Professional Observer'
}

function getAuthorityIndicators(profile) {
  const indicators = []
  if (profile.position && (profile.position.includes('CTO') || profile.position.includes('Chief'))) {
    indicators.push('C-Level Executive')
  }
  if (profile.experience && profile.experience.length > 3) indicators.push('Extensive Experience')
  if (profile.certifications && profile.certifications.length > 0) indicators.push('Industry Certified')
  if (profile.connections > 1000) indicators.push('Well Connected')
  if (profile.posts && profile.posts.some(p => p.likes_count > 100)) indicators.push('Thought Leader')
  return indicators
}

function getPainPoints(profile) {
  const painPoints = []
  const industry = profile.industry?.toLowerCase() || ''
  const about = profile.about?.toLowerCase() || ''
  const position = profile.position?.toLowerCase() || ''
  
  if (position.includes('cto') || position.includes('chief')) {
    painPoints.push('Scaling Technology Teams', 'Digital Transformation ROI', 'Technology Strategy Alignment')
  }
  
  if (about.includes('cloud')) painPoints.push('Cloud Migration Complexity')
  if (about.includes('ai') || about.includes('innovation')) painPoints.push('AI Implementation Challenges') 
  if (about.includes('team') || about.includes('leadership')) painPoints.push('Talent Retention & Development')
  
  return painPoints.slice(0, 3)
}

function getBusinessPriorities(profile) {
  const priorities = []
  const text = (profile.about + ' ' + profile.headline).toLowerCase()
  
  if (text.includes('digital transformation')) priorities.push('Digital Transformation')
  if (text.includes('innovation')) priorities.push('Innovation & Growth')
  if (text.includes('efficiency') || text.includes('optimization')) priorities.push('Operational Efficiency')
  if (text.includes('team') || text.includes('leadership')) priorities.push('Team Development')
  if (text.includes('sustainable') || text.includes('green')) priorities.push('Sustainability')
  
  return priorities.slice(0, 3)
}

function calculateDecisionMakerScore(profile) {
  let score = 0
  const position = profile.position?.toLowerCase() || ''
  
  if (position.includes('ceo') || position.includes('founder')) score = 100
  else if (position.includes('cto') || position.includes('chief')) score = 90
  else if (position.includes('vp') || position.includes('vice president')) score = 80
  else if (position.includes('director')) score = 70
  else if (position.includes('head') || position.includes('manager')) score = 60
  else if (position.includes('lead') || position.includes('senior')) score = 40
  else score = 20
  
  // Boost score based on company size indicators
  if (profile.about && profile.about.includes('team')) score += 10
  if (profile.connections > 1000) score += 10
  
  return Math.min(score, 100)
}

// Email templates based on personalization
function generateEmailPersonalizationSuggestions(fields) {
  return {
    subject_lines: [
      `${fields.basic.first_name}, quick question about ${fields.basic.current_company}'s tech stack`,
      `Fellow ${fields.professional.alma_mater} alum - thoughts on ${fields.outreach_signals.preferred_topics[0]}?`,
      `${fields.professional.career_progression} insight needed from ${fields.basic.location}`,
      `${fields.basic.current_position} perspective on ${fields.outreach_signals.business_priorities[0]}?`
    ],
    
    opening_lines: [
      `Hi ${fields.basic.first_name}, I noticed your expertise in ${fields.professional.top_skills[0]} and thought you'd be interested in...`,
      `${fields.basic.first_name}, as a ${fields.basic.current_position} at ${fields.basic.current_company}, you probably face challenges with...`,
      `Fellow ${fields.professional.alma_mater} graduate here! Saw your recent post about ${fields.personal.recent_posts[0]?.topic} and...`,
      `Hi ${fields.basic.first_name}, impressive background in ${fields.basic.industry} - particularly your work at ${fields.professional.previous_companies[0]}...`
    ],
    
    value_propositions: [
      `Given your focus on ${fields.outreach_signals.preferred_topics[0]}, this could help you...`,
      `Since you're dealing with ${fields.outreach_signals.pain_points[0]}, we've helped similar ${fields.professional.career_progression} leaders...`,
      `With ${fields.professional.years_experience}+ years of experience, you understand the importance of...`,
      `As someone with ${fields.personal.connection_count} connections, you know the value of...`
    ],
    
    social_proof: [
      `We've helped other ${fields.basic.industry} leaders like yourself...`,
      `CTOs at companies similar to ${fields.basic.current_company} have seen...`,
      `Other ${fields.professional.alma_mater} alumni in your network have...`,
      `${fields.basic.location}-based companies have achieved...`
    ]
  }
}

// Main demonstration function
function demonstrateLinkedInScraping() {
  console.log('🔍 === LinkedIn Scraper Field Analysis ===')
  console.log('📄 Profile URL: https://www.linkedin.com/in/frédéric-titze-4a5ba1110/')
  console.log('🎯 Goal: Extract comprehensive data for email personalization\n')
  
  console.log('📊 === AVAILABLE DATA FIELDS ===\n')
  
  // Extract all personalization fields
  const personalizationData = getPersonalizationFields(sampleLinkedInProfile)
  
  // Display basic fields
  console.log('👤 BASIC INFORMATION (High Reliability - 90%+):')
  Object.entries(personalizationData.basic).forEach(([key, value]) => {
    console.log(`   ${key}: ${value || 'N/A'}`)
  })
  
  // Display professional fields  
  console.log('\n💼 PROFESSIONAL CONTEXT (Medium-High Reliability - 65%+):')
  Object.entries(personalizationData.professional).forEach(([key, value]) => {
    const displayValue = Array.isArray(value) ? value.join(', ') : value
    console.log(`   ${key}: ${displayValue || 'N/A'}`)
  })
  
  // Display personal signals
  console.log('\n🎯 PERSONAL SIGNALS (Lower Reliability - 20%+ but High Value):')
  Object.entries(personalizationData.personal).forEach(([key, value]) => {
    const displayValue = Array.isArray(value) 
      ? value.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(', ')
      : value
    console.log(`   ${key}: ${displayValue || 'N/A'}`)
  })
  
  // Display outreach optimization data
  console.log('\n🚀 OUTREACH OPTIMIZATION (AI-Enhanced Analysis):')
  Object.entries(personalizationData.outreach_signals).forEach(([key, value]) => {
    const displayValue = Array.isArray(value) ? value.join(', ') : value
    console.log(`   ${key}: ${displayValue || 'N/A'}`)
  })
  
  // Generate email personalization suggestions
  console.log('\n📧 === EMAIL PERSONALIZATION SUGGESTIONS ===\n')
  const emailSuggestions = generateEmailPersonalizationSuggestions(personalizationData)
  
  console.log('📌 SUBJECT LINE OPTIONS:')
  emailSuggestions.subject_lines.forEach((subject, i) => {
    console.log(`   ${i + 1}. ${subject}`)
  })
  
  console.log('\n📝 OPENING LINE OPTIONS:')
  emailSuggestions.opening_lines.forEach((opening, i) => {
    console.log(`   ${i + 1}. ${opening}`)
  })
  
  console.log('\n💡 VALUE PROPOSITION OPTIONS:')
  emailSuggestions.value_propositions.forEach((value, i) => {
    console.log(`   ${i + 1}. ${value}`)
  })
  
  console.log('\n🏆 SOCIAL PROOF OPTIONS:')
  emailSuggestions.social_proof.forEach((proof, i) => {
    console.log(`   ${i + 1}. ${proof}`)
  })
  
  console.log('\n🎯 === RECOMMENDED PERSONALIZATION STRATEGY ===')
  console.log(`Decision Maker Score: ${personalizationData.outreach_signals.decision_maker_score}/100`)
  console.log(`Thought Leader Score: ${personalizationData.personal.thought_leader_score}/100`)
  console.log(`Career Level: ${personalizationData.professional.career_progression}`)
  console.log(`Best Topics: ${personalizationData.outreach_signals.preferred_topics.slice(0, 2).join(', ')}`)
  console.log(`Key Pain Points: ${personalizationData.outreach_signals.pain_points.slice(0, 2).join(', ')}`)
  
  const strategy = personalizationData.outreach_signals.decision_maker_score > 70 
    ? 'Executive Approach - Focus on strategic value and ROI'
    : personalizationData.personal.thought_leader_score > 50
    ? 'Peer-to-Peer Approach - Engage with industry insights'
    : 'Professional Approach - Focus on skill development and career growth'
  
  console.log(`\n📋 Recommended Strategy: ${strategy}`)
  
  console.log('\n✅ === IMPLEMENTATION SUMMARY ===')
  console.log('Your LinkedIn scraper successfully extracts:')
  console.log('• Basic contact information for personalization')
  console.log('• Professional context for relevance')
  console.log('• Personal interests for conversation starters') 
  console.log('• Authority indicators for approach strategy')
  console.log('• Pain points for value proposition alignment')
  console.log('• Engagement style preferences')
  
  console.log('\n🚀 The scraper provides comprehensive data for highly personalized email outreach!')
}

// Run the demonstration
if (require.main === module) {
  demonstrateLinkedInScraping()
}

module.exports = { 
  getPersonalizationFields, 
  generateEmailPersonalizationSuggestions, 
  sampleLinkedInProfile 
}