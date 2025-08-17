// Security utilities for medical translator app
export interface SanitizationResult {
  sanitized: string
  isValid: boolean
  warnings: string[]
  medicalTerms: string[]
}

// Medical term patterns for validation
const MEDICAL_PATTERNS = {
  symptoms: [
    /pain|ache|hurt|sore|discomfort/i,
    /fever|temperature|hot|cold|chills/i,
    /nausea|vomit|sick|queasy/i,
    /dizzy|dizziness|vertigo|lightheaded/i,
    /breath|breathing|shortness|wheezing/i
  ]
}

// Input sanitization function
export function sanitizeInput(input: string): SanitizationResult {
  const warnings: string[] = []
  const medicalTerms: string[] = []
  
  if (!input || typeof input !== 'string') {
    return {
      sanitized: '',
      isValid: false,
      warnings: ['Invalid input type'],
      medicalTerms: []
    }
  }

  let sanitized = input.trim()

  // Check length limits
  if (sanitized.length > 1000) {
    warnings.push('Input truncated to 1000 characters')
    sanitized = sanitized.substring(0, 1000)
  }

  // Remove potentially dangerous HTML/script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')

  // Remove dangerous characters but preserve medical terminology
  sanitized = sanitized.replace(/[<>\"'&]/g, (match) => {
    switch (match) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#x27;'
      case '&': return '&amp;'
      default: return match
    }
  })

  // Extract medical terms for validation
  Object.values(MEDICAL_PATTERNS).flat().forEach(pattern => {
    const matches = sanitized.match(pattern)
    if (matches) {
      medicalTerms.push(...matches)
    }
  })

  return {
    sanitized,
    isValid: sanitized.length > 0 && warnings.length < 3,
    warnings,
    medicalTerms: [...new Set(medicalTerms)]
  }
}

// Output encoding for XSS protection
export function encodeOutput(text: string): string {
  if (!text || typeof text !== 'string') return ''
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}
