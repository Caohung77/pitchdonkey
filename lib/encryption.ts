import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef'
const ALGORITHM = 'aes-256-gcm'

export class EncryptionService {
  private static key = Buffer.from(ENCRYPTION_KEY, 'hex')

  static encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipher(ALGORITHM, this.key)
      
      let encrypted = cipher.update(text, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      const authTag = cipher.getAuthTag()
      
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
    } catch (error) {
      console.error('Encryption error:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  static decrypt(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':')
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format')
      }

      const iv = Buffer.from(parts[0], 'hex')
      const authTag = Buffer.from(parts[1], 'hex')
      const encrypted = parts[2]

      const decipher = crypto.createDecipher(ALGORITHM, this.key)
      decipher.setAuthTag(authTag)

      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch (error) {
      console.error('Decryption error:', error)
      throw new Error('Failed to decrypt data')
    }
  }

  static encryptObject(obj: any): string {
    return this.encrypt(JSON.stringify(obj))
  }

  static decryptObject<T>(encryptedData: string): T {
    const decrypted = this.decrypt(encryptedData)
    return JSON.parse(decrypted)
  }

  static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
    return salt + ':' + hash
  }

  static verifyPassword(password: string, hashedPassword: string): boolean {
    try {
      const parts = hashedPassword.split(':')
      if (parts.length !== 2) return false

      const salt = parts[0]
      const hash = parts[1]
      const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
      
      return hash === verifyHash
    } catch (error) {
      return false
    }
  }

  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  static generateApiKey(): string {
    const prefix = 'crp_' // ColdReach Pro prefix
    const key = crypto.randomBytes(32).toString('hex')
    return prefix + key
  }
}

// Utility functions for email account encryption
export const encryptEmailCredentials = (credentials: any): string => {
  return EncryptionService.encryptObject(credentials)
}

export const decryptEmailCredentials = <T>(encryptedCredentials: string): T => {
  return EncryptionService.decryptObject<T>(encryptedCredentials)
}

// Utility functions for OAuth token encryption
export const encryptOAuthTokens = (tokens: any): string => {
  return EncryptionService.encryptObject(tokens)
}

export const decryptOAuthTokens = <T>(encryptedTokens: string): T => {
  return EncryptionService.decryptObject<T>(encryptedTokens)
}

// Utility functions for SMTP config encryption
export const encryptSMTPConfig = (config: any): string => {
  return EncryptionService.encryptObject(config)
}

export const decryptSMTPConfig = <T>(encryptedConfig: string): T => {
  return EncryptionService.decryptObject<T>(encryptedConfig)
}