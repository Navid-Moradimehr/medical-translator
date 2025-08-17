// HIPAA compliance utilities for medical translator app
// Handles data anonymization, audit trails, and privacy protection

export interface AuditLogEntry {
  timestamp: string
  userId: string
  action: string
  dataHash: string
  sessionId: string
  ipAddress?: string
  userAgent?: string
}

export interface AnonymizedData {
  originalHash: string
  anonymizedData: any
  timestamp: string
  retentionDays: number
}

export interface ConsentSettings {
  dataCollection: boolean
  dataStorage: boolean
  dataSharing: boolean
  analytics: boolean
  timestamp: string
}

export interface PrivacySettings {
  maxRetentionDays: number
  autoDelete: boolean
  anonymizePII: boolean
  auditLogging: boolean
}

class HIPAACompliance {
  private static instance: HIPAACompliance
  private readonly AUDIT_LOG_KEY = 'medical_translator_audit_log'
  private readonly CONSENT_KEY = 'medical_translator_consent'
  private readonly PRIVACY_KEY = 'medical_translator_privacy'
  private readonly MAX_AUDIT_LOG_SIZE = 1000
  private readonly DEFAULT_RETENTION_DAYS = 7

  private constructor() {}

  static getInstance(): HIPAACompliance {
    if (!HIPAACompliance.instance) {
      HIPAACompliance.instance = new HIPAACompliance()
    }
    return HIPAACompliance.instance
  }

  // Initialize privacy settings
  initializePrivacySettings(): PrivacySettings {
    const defaultSettings: PrivacySettings = {
      maxRetentionDays: this.DEFAULT_RETENTION_DAYS,
      autoDelete: true,
      anonymizePII: true,
      auditLogging: true
    }

    try {
      const stored = localStorage.getItem(this.PRIVACY_KEY)
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) }
      }
    } catch (error) {
      console.error('Error loading privacy settings:', error)
    }

    // Store default settings
    localStorage.setItem(this.PRIVACY_KEY, JSON.stringify(defaultSettings))
    return defaultSettings
  }

  // Get privacy settings
  getPrivacySettings(): PrivacySettings {
    return this.initializePrivacySettings()
  }

  // Update privacy settings
  updatePrivacySettings(settings: Partial<PrivacySettings>): void {
    const current = this.getPrivacySettings()
    const updated = { ...current, ...settings }
    localStorage.setItem(this.PRIVACY_KEY, JSON.stringify(updated))
  }

  // Initialize consent settings
  initializeConsent(): ConsentSettings {
    const defaultConsent: ConsentSettings = {
      dataCollection: false,
      dataStorage: false,
      dataSharing: false,
      analytics: false,
      timestamp: new Date().toISOString()
    }

    try {
      const stored = localStorage.getItem(this.CONSENT_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error('Error loading consent settings:', error)
    }

    return defaultConsent
  }

  // Get consent settings
  getConsent(): ConsentSettings {
    return this.initializeConsent()
  }

  // Update consent settings
  updateConsent(consent: Partial<ConsentSettings>): void {
    const current = this.getConsent()
    const updated = { 
      ...current, 
      ...consent, 
      timestamp: new Date().toISOString() 
    }
    localStorage.setItem(this.CONSENT_KEY, JSON.stringify(updated))
  }

  // Check if consent is given for specific action
  hasConsent(action: keyof ConsentSettings): boolean {
    const consent = this.getConsent()
    return consent[action] || false
  }

  // Hash data for audit trail
  private hashData(data: any): string {
    const dataString = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }

  // Generate session ID
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Get user ID (anonymized)
  private getUserId(): string {
    // Use a combination of browser fingerprint and timestamp
    const fingerprint = navigator.userAgent + navigator.language + screen.width + screen.height
    let hash = 0
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return `user_${hash.toString(16)}`
  }

  // Log audit entry
  logAuditEntry(action: string, data?: any): void {
    if (!this.hasConsent('auditLogging')) {
      return
    }

    try {
      const auditEntry: AuditLogEntry = {
        timestamp: new Date().toISOString(),
        userId: this.getUserId(),
        action,
        dataHash: data ? this.hashData(data) : '',
        sessionId: this.generateSessionId(),
        userAgent: navigator.userAgent
      }

      // Get existing audit log
      const existingLog = this.getAuditLog()
      existingLog.push(auditEntry)

      // Limit audit log size
      if (existingLog.length > this.MAX_AUDIT_LOG_SIZE) {
        existingLog.splice(0, existingLog.length - this.MAX_AUDIT_LOG_SIZE)
      }

      // Store updated audit log
      localStorage.setItem(this.AUDIT_LOG_KEY, JSON.stringify(existingLog))
    } catch (error) {
      console.error('Failed to log audit entry:', error)
    }
  }

  // Get audit log
  getAuditLog(): AuditLogEntry[] {
    try {
      const stored = localStorage.getItem(this.AUDIT_LOG_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error loading audit log:', error)
      return []
    }
  }

  // Clear audit log
  clearAuditLog(): void {
    localStorage.removeItem(this.AUDIT_LOG_KEY)
  }

  // Anonymize data
  anonymizeData(data: any): AnonymizedData {
    const anonymized = this.removePII(data)
    
    return {
      originalHash: this.hashData(data),
      anonymizedData: anonymized,
      timestamp: new Date().toISOString(),
      retentionDays: this.getPrivacySettings().maxRetentionDays
    }
  }

  // Remove personally identifiable information
  private removePII(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data
    }

    if (Array.isArray(data)) {
      return data.map(item => this.removePII(item))
    }

    const anonymized: any = {}
    const piiPatterns = [
      /name/i,
      /email/i,
      /phone/i,
      /address/i,
      /ssn/i,
      /social.*security/i,
      /birth.*date/i,
      /dob/i,
      /patient.*id/i,
      /doctor.*id/i
    ]

    for (const [key, value] of Object.entries(data)) {
      const isPII = piiPatterns.some(pattern => pattern.test(key))
      
      if (isPII) {
        anonymized[key] = '[REDACTED]'
      } else if (typeof value === 'object' && value !== null) {
        anonymized[key] = this.removePII(value)
      } else {
        anonymized[key] = value
      }
    }

    return anonymized
  }

  // Check if data contains PII
  containsPII(data: any): boolean {
    const dataString = JSON.stringify(data).toLowerCase()
    const piiPatterns = [
      /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/, // Email
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{3}-\d{3}-\d{4}\b/, // Phone
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, // IP address
      /\b\d{5}(-\d{4})?\b/ // ZIP code
    ]

    return piiPatterns.some(pattern => pattern.test(dataString))
  }

  // Auto-delete expired data
  autoDeleteExpiredData(): void {
    const settings = this.getPrivacySettings()
    if (!settings.autoDelete) {
      return
    }

    try {
      // Clean up audit log
      const auditLog = this.getAuditLog()
      const cutoffTime = Date.now() - (settings.maxRetentionDays * 24 * 60 * 60 * 1000)
      const filteredLog = auditLog.filter(entry => 
        new Date(entry.timestamp).getTime() > cutoffTime
      )

      if (filteredLog.length !== auditLog.length) {
        localStorage.setItem(this.AUDIT_LOG_KEY, JSON.stringify(filteredLog))
        console.log(`Cleaned up ${auditLog.length - filteredLog.length} expired audit entries`)
      }

      // Clean up conversations (if stored)
      const conversations = this.getStoredConversations()
      const filteredConversations = conversations.filter(conv => 
        new Date(conv.timestamp).getTime() > cutoffTime
      )

      if (filteredConversations.length !== conversations.length) {
        this.storeConversations(filteredConversations)
        console.log(`Cleaned up ${conversations.length - filteredConversations.length} expired conversations`)
      }
    } catch (error) {
      console.error('Error during auto-delete:', error)
    }
  }

  // Store conversations with privacy protection
  storeConversations(conversations: any[]): void {
    if (!this.hasConsent('dataStorage')) {
      return
    }

    try {
      const anonymizedConversations = conversations.map(conv => 
        this.anonymizeData(conv)
      )
      
      localStorage.setItem('medical_translator_conversations', JSON.stringify(anonymizedConversations))
    } catch (error) {
      console.error('Error storing conversations:', error)
    }
  }

  // Get stored conversations
  getStoredConversations(): any[] {
    try {
      const stored = localStorage.getItem('medical_translator_conversations')
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error loading conversations:', error)
      return []
    }
  }

  // Export data with privacy protection
  exportData(format: 'json' | 'csv' | 'pdf' = 'json'): string {
    if (!this.hasConsent('dataSharing')) {
      throw new Error('Data sharing consent not given')
    }

    const conversations = this.getStoredConversations()
    const auditLog = this.getAuditLog()
    
    const exportData = {
      conversations: conversations.map(conv => conv.anonymizedData),
      auditLog: auditLog.map(entry => ({
        timestamp: entry.timestamp,
        action: entry.action,
        sessionId: entry.sessionId
      })),
      exportTimestamp: new Date().toISOString(),
      privacySettings: this.getPrivacySettings(),
      consentSettings: this.getConsent()
    }

    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, 2)
      case 'csv':
        return this.convertToCSV(exportData)
      case 'pdf':
        return this.convertToPDF(exportData)
      default:
        return JSON.stringify(exportData, null, 2)
    }
  }

  // Convert data to CSV
  private convertToCSV(data: any): string {
    // Simple CSV conversion for conversations
    const conversations = data.conversations || []
    if (conversations.length === 0) {
      return 'No data to export'
    }

    const headers = ['Timestamp', 'Role', 'Original Text', 'Translated Text', 'Language']
    const rows = conversations.flatMap(conv => 
      conv.messages?.map((msg: any) => [
        msg.timestamp,
        msg.isDoctor ? 'Doctor' : 'Patient',
        msg.text,
        msg.translatedText,
        msg.language
      ]) || []
    )

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    return csvContent
  }

  // Convert data to PDF (placeholder)
  private convertToPDF(data: any): string {
    // This would require a PDF library like jsPDF
    // For now, return a placeholder
    return `PDF export not implemented. Use JSON or CSV format.\nData: ${JSON.stringify(data, null, 2)}`
  }

  // Get compliance status
  getComplianceStatus(): {
    consentGiven: boolean
    auditLogging: boolean
    dataRetention: boolean
    piiProtection: boolean
    lastAudit: string | null
  } {
    const consent = this.getConsent()
    const privacy = this.getPrivacySettings()
    const auditLog = this.getAuditLog()

    return {
      consentGiven: Object.values(consent).some(Boolean),
      auditLogging: privacy.auditLogging && consent.auditLogging,
      dataRetention: privacy.autoDelete,
      piiProtection: privacy.anonymizePII,
      lastAudit: auditLog.length > 0 ? auditLog[auditLog.length - 1].timestamp : null
    }
  }
}

// Export singleton instance
export const hipaaCompliance = HIPAACompliance.getInstance()

// Privacy consent dialog component
export function createPrivacyConsentDialog(
  onAccept: () => void,
  onDecline: () => void
): HTMLElement {
  const dialog = document.createElement('div')
  dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
  dialog.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-md mx-4">
      <h3 class="text-lg font-semibold mb-4">Privacy and Data Protection</h3>
      <p class="text-sm text-gray-600 mb-4">
        This medical translator app collects and processes data to provide translation services. 
        We are committed to protecting your privacy and complying with HIPAA regulations.
      </p>
      <div class="space-y-2 mb-4">
        <label class="flex items-center">
          <input type="checkbox" id="dataCollection" class="mr-2">
          <span class="text-sm">Allow data collection for translation services</span>
        </label>
        <label class="flex items-center">
          <input type="checkbox" id="dataStorage" class="mr-2">
          <span class="text-sm">Store conversation history (encrypted)</span>
        </label>
        <label class="flex items-center">
          <input type="checkbox" id="auditLogging" class="mr-2">
          <span class="text-sm">Log usage for security and compliance</span>
        </label>
      </div>
      <div class="flex space-x-2">
        <button id="acceptBtn" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded">
          Accept
        </button>
        <button id="declineBtn" class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded">
          Decline
        </button>
      </div>
    </div>
  `

  dialog.querySelector('#acceptBtn')?.addEventListener('click', () => {
    const dataCollection = (dialog.querySelector('#dataCollection') as HTMLInputElement).checked
    const dataStorage = (dialog.querySelector('#dataStorage') as HTMLInputElement).checked
    const auditLogging = (dialog.querySelector('#auditLogging') as HTMLInputElement).checked

    hipaaCompliance.updateConsent({
      dataCollection,
      dataStorage,
      dataSharing: dataStorage,
      analytics: dataCollection,
      auditLogging
    })

    document.body.removeChild(dialog)
    onAccept()
  })

  dialog.querySelector('#declineBtn')?.addEventListener('click', () => {
    document.body.removeChild(dialog)
    onDecline()
  })

  return dialog
}
