/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { EnrichmentButton } from '@/components/contacts/EnrichmentButton'

// Mock the ApiClient
jest.mock('@/lib/api-client', () => ({
  ApiClient: {
    post: jest.fn()
  }
}))

describe('EnrichmentButton', () => {
  const mockProps = {
    contactId: 'test-contact-id',
    hasWebsite: true,
    hasLinkedIn: true,
    linkedInUrl: 'https://linkedin.com/in/test',
    currentStatus: null as const,
    linkedInStatus: null as const,
    onEnrichmentComplete: jest.fn(),
    size: 'sm' as const,
    className: ''
  }

  it('shows separate buttons for website and LinkedIn when both are available', () => {
    render(<EnrichmentButton {...mockProps} />)
    
    expect(screen.getByText('Enrich from Website')).toBeInTheDocument()
    expect(screen.getByText('Extract from LinkedIn')).toBeInTheDocument()
  })

  it('shows website enriched badge when website enrichment is completed', () => {
    render(<EnrichmentButton {...mockProps} currentStatus="completed" />)
    
    expect(screen.getByText('Website Enriched')).toBeInTheDocument()
    expect(screen.getByText('Extract from LinkedIn')).toBeInTheDocument()
  })

  it('shows LinkedIn enriched badge when LinkedIn enrichment is completed', () => {
    render(<EnrichmentButton {...mockProps} linkedInStatus="completed" />)
    
    expect(screen.getByText('LinkedIn Enriched')).toBeInTheDocument()
    expect(screen.getByText('Enrich from Website')).toBeInTheDocument()
  })

  it('shows both enriched badges when both are completed', () => {
    render(<EnrichmentButton {...mockProps} currentStatus="completed" linkedInStatus="completed" />)
    
    expect(screen.getByText('Website Enriched')).toBeInTheDocument()
    expect(screen.getByText('LinkedIn Enriched')).toBeInTheDocument()
  })

  it('shows only LinkedIn button when no website is available', () => {
    render(<EnrichmentButton {...mockProps} hasWebsite={false} />)
    
    expect(screen.queryByText('Enrich from Website')).not.toBeInTheDocument()
    expect(screen.getByText('Extract from LinkedIn')).toBeInTheDocument()
  })

  it('shows no sources message when neither website nor LinkedIn are available', () => {
    render(<EnrichmentButton {...mockProps} hasWebsite={false} hasLinkedIn={false} />)
    
    expect(screen.getByText('No enrichment sources')).toBeInTheDocument()
  })
})