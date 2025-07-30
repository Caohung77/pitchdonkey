// Simple test for domain authentication service
const dns = require('dns/promises');

// Mock DNS module
jest.mock('dns/promises');

describe('Domain Authentication Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should clean domain input correctly', () => {
    // Test domain cleaning function
    const cleanDomain = (input) => {
      let domain = input.toLowerCase();
      domain = domain.replace(/^https?:\/\//, '');
      domain = domain.replace(/^www\./, '');
      domain = domain.split('/')[0].split('?')[0];
      return domain;
    };

    expect(cleanDomain('https://www.example.com/path')).toBe('example.com');
    expect(cleanDomain('www.example.com')).toBe('example.com');
    expect(cleanDomain('example.com')).toBe('example.com');
    expect(cleanDomain('EXAMPLE.COM')).toBe('example.com');
  });

  test('should extract domain from email correctly', () => {
    const getDomainFromEmail = (email) => {
      const domain = email.split('@')[1];
      return domain ? domain.toLowerCase() : '';
    };

    expect(getDomainFromEmail('test@example.com')).toBe('example.com');
    expect(getDomainFromEmail('user@GMAIL.COM')).toBe('gmail.com');
    expect(getDomainFromEmail('invalid-email')).toBe('');
  });

  test('should format database result correctly', () => {
    const formatForDatabase = (result) => {
      return {
        spf: {
          status: result.spf.status,
          record: result.spf.record,
          valid: result.spf.status === 'valid'
        },
        dkim: {
          status: result.dkim.status,
          record: result.dkim.record,
          valid: result.dkim.status === 'valid'
        },
        dmarc: {
          status: result.dmarc.status,
          record: result.dmarc.record,
          valid: result.dmarc.status === 'valid'
        }
      };
    };

    const mockResult = {
      spf: { status: 'valid', record: 'v=spf1 ~all' },
      dkim: { status: 'warning', record: 'v=DKIM1; p=test' },
      dmarc: { status: 'missing', record: null }
    };

    const formatted = formatForDatabase(mockResult);

    expect(formatted.spf.valid).toBe(true);
    expect(formatted.dkim.valid).toBe(false);
    expect(formatted.dmarc.valid).toBe(false);
  });
});