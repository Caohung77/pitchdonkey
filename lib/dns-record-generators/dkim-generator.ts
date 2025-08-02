import { DKIMConfig, DKIMRecord, DNSRecord } from '@/lib/types/domain-auth'
import { createHash, generateKeyPairSync } from 'crypto'

/**
 * DKIM (DomainKeys Identified Mail) Record Generator
 * Generates DKIM key pairs and DNS records for email authentication
 */
export class DKIMGenerator {
  /**
   * Generate DKIM key pair and DNS record
   */
  static generateKeyPair(domain: string, selector: string = 'coldreach2024', keySize: 1024 | 2048 = 2048): DKIMConfig {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    })
    
    return {
      domain,
      selector,
      keySize,
      publicKey,
      privateKey
    }
  }
  
  /**
   * Generate DKIM DNS record from configuration
   */
  static generateRecord(config: DKIMConfig): { record: DNSRecord; parsed: DKIMRecord } {
    // Extract public key from PEM format
    const publicKeyBase64 = this.extractPublicKeyFromPEM(config.publicKey)
    
    // Build DKIM record value
    const dkimValue = `v=DKIM1; k=rsa; p=${publicKeyBase64}`
    
    const record: DNSRecord = {
      type: 'TXT',
      name: `${config.selector}._domainkey.${config.domain}`,
      value: dkimValue,
      ttl: 3600
    }
    
    const parsed: DKIMRecord = {
      version: 'DKIM1',
      keyType: 'rsa',
      publicKey: publicKeyBase64,
      selector: config.selector,
      raw: dkimValue
    }
    
    return { record, parsed }
  }
  
  /**
   * Generate DKIM configuration for a domain with automatic selector
   */
  static generateForDomain(domain: string, keySize: 1024 | 2048 = 2048): { config: DKIMConfig; record: DNSRecord; parsed: DKIMRecord } {
    // Generate unique selector based on domain and current date
    const selector = this.generateSelector(domain)
    const config = this.generateKeyPair(domain, selector, keySize)
    const { record, parsed } = this.generateRecord(config)
    
    return { config, record, parsed }
  }
  
  /**
   * Validate DKIM record syntax
   */
  static validateRecord(dkimRecord: string): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Check if record starts with v=DKIM1
    if (!dkimRecord.includes('v=DKIM1')) {
      errors.push('DKIM record must include "v=DKIM1"')
    }
    
    // Check for required key type
    if (!dkimRecord.includes('k=rsa')) {
      warnings.push('DKIM record should specify key type "k=rsa"')
    }
    
    // Check for public key
    const publicKeyMatch = dkimRecord.match(/p=([A-Za-z0-9+/=]+)/)
    if (!publicKeyMatch) {
      errors.push('DKIM record must include public key "p=" parameter')
    } else {
      const publicKey = publicKeyMatch[1]
      if (publicKey.length === 0) {
        errors.push('DKIM public key cannot be empty')
      } else if (!this.isValidBase64(publicKey)) {
        errors.push('DKIM public key must be valid base64')
      }
    }
    
    // Check record length
    if (dkimRecord.length > 255) {
      warnings.push('DKIM record is longer than 255 characters, you may need to split it into multiple strings')
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
  
  /**
   * Parse existing DKIM record
   */
  static parseRecord(dkimRecord: string, selector: string): DKIMRecord | null {
    if (!dkimRecord.includes('v=DKIM1')) {
      return null
    }
    
    const publicKeyMatch = dkimRecord.match(/p=([A-Za-z0-9+/=]+)/)
    const keyTypeMatch = dkimRecord.match(/k=(\w+)/)
    
    if (!publicKeyMatch) {
      return null
    }
    
    return {
      version: 'DKIM1',
      keyType: keyTypeMatch ? keyTypeMatch[1] : 'rsa',
      publicKey: publicKeyMatch[1],
      selector,
      raw: dkimRecord
    }
  }
  
  /**
   * Get setup instructions for DKIM
   */
  static getSetupInstructions(domain: string, selector: string, record: DNSRecord): string {
    return `
To set up DKIM for ${domain}:

1. Log in to your DNS provider (GoDaddy, Cloudflare, Namecheap, etc.)
2. Go to DNS management for ${domain}
3. Add a new TXT record:
   - Name/Host: ${selector}._domainkey
   - Type: TXT
   - Value: ${record.value}
   - TTL: 3600 (or 1 hour)

What this does:
- DKIM adds a digital signature to your emails using cryptographic keys
- The private key signs outgoing emails, the public key (in DNS) verifies them
- This proves the email actually came from your domain and wasn't modified
- Significantly improves email deliverability and reduces spam classification

Important notes:
- Keep your private key secure - never share it or put it in DNS
- The selector (${selector}) is like a version number for your keys
- You can have multiple DKIM records with different selectors for key rotation
- If the record is too long, your DNS provider may require splitting it into multiple strings

Testing: After adding the record, you can verify it's working by sending a test email and checking the email headers for DKIM-Signature.
    `.trim()
  }
  
  /**
   * Generate a unique selector for the domain
   */
  private static generateSelector(domain: string): string {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    
    // Create a short hash of the domain for uniqueness
    const domainHash = createHash('md5').update(domain).digest('hex').substring(0, 6)
    
    return `coldreach${year}${month}${domainHash}`
  }
  
  /**
   * Extract base64 public key from PEM format
   */
  private static extractPublicKeyFromPEM(pemKey: string): string {
    return pemKey
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\n/g, '')
      .replace(/\r/g, '')
      .trim()
  }
  
  /**
   * Validate base64 string
   */
  private static isValidBase64(str: string): boolean {
    try {
      return Buffer.from(str, 'base64').toString('base64') === str
    } catch {
      return false
    }
  }
  
  /**
   * Split long DKIM record into multiple DNS strings (for providers that require it)
   */
  static splitLongRecord(dkimValue: string): string[] {
    if (dkimValue.length <= 255) {
      return [dkimValue]
    }
    
    // Find the public key part
    const publicKeyMatch = dkimValue.match(/p=([A-Za-z0-9+/=]+)/)
    if (!publicKeyMatch) {
      return [dkimValue]
    }
    
    const beforeKey = dkimValue.substring(0, publicKeyMatch.index! + 2) // Include "p="
    const publicKey = publicKeyMatch[1]
    const afterKey = dkimValue.substring(publicKeyMatch.index! + 2 + publicKey.length)
    
    // Split the public key into chunks
    const maxChunkSize = 255 - beforeKey.length - afterKey.length - 10 // Leave some buffer
    const chunks: string[] = []
    
    if (maxChunkSize > 50) {
      // Can fit in multiple strings
      for (let i = 0; i < publicKey.length; i += maxChunkSize) {
        const chunk = publicKey.substring(i, i + maxChunkSize)
        if (i === 0) {
          chunks.push(`${beforeKey}${chunk}`)
        } else if (i + maxChunkSize >= publicKey.length) {
          chunks.push(`${chunk}${afterKey}`)
        } else {
          chunks.push(chunk)
        }
      }
    } else {
      // Record is too complex to split nicely, return as-is
      chunks.push(dkimValue)
    }
    
    return chunks
  }
  
  /**
   * Encrypt private key for secure storage
   */
  static encryptPrivateKey(privateKey: string, password: string): string {
    // In a real implementation, you'd use proper encryption
    // For now, this is a placeholder that would use AES encryption
    const crypto = require('crypto')
    const algorithm = 'aes-256-gcm'
    const key = crypto.scryptSync(password, 'salt', 32)
    const iv = crypto.randomBytes(16)
    
    const cipher = crypto.createCipher(algorithm, key)
    cipher.setAAD(Buffer.from('dkim-private-key'))
    
    let encrypted = cipher.update(privateKey, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  }
  
  /**
   * Decrypt private key from secure storage
   */
  static decryptPrivateKey(encryptedKey: string, password: string): string {
    // In a real implementation, you'd use proper decryption
    // This is a placeholder that would use AES decryption
    const crypto = require('crypto')
    const algorithm = 'aes-256-gcm'
    const key = crypto.scryptSync(password, 'salt', 32)
    
    const [ivHex, authTagHex, encrypted] = encryptedKey.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    const decipher = crypto.createDecipher(algorithm, key)
    decipher.setAAD(Buffer.from('dkim-private-key'))
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}