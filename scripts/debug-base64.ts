#!/usr/bin/env tsx

const publicKey = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuFsHtdy7naeTxnuRleEZWbJGuNR9MDtZZypT3fdOpOT23CvWC/j+JPrV10IyNvjIhIMoUjsrpX+E2LnP3AUQJI1hRwXs4pyJhHCXXcU/k3Kbdn56v2GQCXBcKBCqoyz21GlIQ3T9JMINfAQuBjHlYuP2aC4GZT76DrelKCJ6RMBA67maOLlWYpGklcg/MTMXFcT8p7TsY/fVXrFbQF5IosCzX3vBrLccFV/iwmr9X2t1U4RA1Qcx0rVWGZoTJs3oQ7ermeoYF7vRrWXGrh9j0ICGd0JnlX1U4YeNG6m2LsvT09jovKtMqIrY9mU1XK7476YwaB3uvipoo8wRHoo6AwIDAQAB"

console.log(`Original key: ${publicKey}`)
console.log(`Length: ${publicKey.length}`)

function isValidBase64(str: string): boolean {
  try {
    const result = Buffer.from(str, 'base64').toString('base64') === str
    console.log(`isValidBase64 result: ${result}`)
    console.log(`Original:  ${str}`)
    console.log(`Roundtrip: ${Buffer.from(str, 'base64').toString('base64')}`)
    console.log(`Match: ${Buffer.from(str, 'base64').toString('base64') === str}`)
    return result
  } catch (e) {
    console.log(`isValidBase64 threw error: ${e}`)
    return false
  }
}

// Test the base64 validation
const isValid = isValidBase64(publicKey)
console.log(`\nFinal result: ${isValid}`)

// Test if it can be decoded
try {
  const decoded = Buffer.from(publicKey, 'base64')
  console.log(`✅ Successfully decoded, length: ${decoded.length}`)
} catch (e) {
  console.log(`❌ Failed to decode: ${e}`)
}