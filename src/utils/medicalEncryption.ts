// Medical data encryption utilities for HIPAA compliance
// Provides end-to-end encryption for all medical conversations and data

export interface EncryptedMedicalData {
  data: string
  iv: string
  timestamp: number
  version: string
  dataType: 'conversation' | 'summary' | 'extraction'
}

export interface MedicalEncryptionResult {
  success: boolean
  encryptedData?: string
  error?: string
}

class MedicalEncryption {
  private static instance: MedicalEncryption
  private encryptionKey: CryptoKey | null = null
  private readonly MEDICAL_KEY_NAME = 'medical_translator_medical_key'
  private readonly VERSION = '1.0'

  private constructor() {}

  static getInstance(): MedicalEncryption {
    if (!MedicalEncryption.instance) {
      MedicalEncryption.instance = new MedicalEncryption()
    }
    return MedicalEncryption.instance
  }

  // Initialize medical encryption key
  async initialize(): Promise<boolean> {
    try {
      const existingKey = await this.getOrCreateMedicalKey()
      if (existingKey) {
        this.encryptionKey = existingKey
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to initialize medical encryption:', error)
      return false
    }
  }

  // Get or create medical encryption key
  private async getOrCreateMedicalKey(): Promise<CryptoKey | null> {
    try {
      const keyData = await this.getMedicalKeyFromStorage()
      
      if (keyData) {
        // Import existing key
        return await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        )
      } else {
        // Generate new key
        const newKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        )
        
        // Export and store the key
        const exportedKey = await crypto.subtle.exportKey('raw', newKey)
        await this.storeMedicalKey(exportedKey)
        
        return newKey
      }
    } catch (error) {
      console.error('Error getting/creating medical encryption key:', error)
      return null
    }
  }

  // Store medical encryption key
  private async storeMedicalKey(keyData: ArrayBuffer): Promise<void> {
    try {
      const keyString = btoa(String.fromCharCode(...new Uint8Array(keyData)))
      localStorage.setItem(this.MEDICAL_KEY_NAME, keyString)
    } catch (error) {
      console.error('Failed to store medical encryption key:', error)
      throw error
    }
  }

  // Get medical encryption key from storage
  private async getMedicalKeyFromStorage(): Promise<ArrayBuffer | null> {
    try {
      const keyString = localStorage.getItem(this.MEDICAL_KEY_NAME)
      if (keyString) {
        const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0))
        return keyData.buffer
      }
    } catch (error) {
      console.error('Failed to get medical key from localStorage:', error)
    }
    
    return null
  }

  // Encrypt medical data
  async encryptMedicalData(data: any, dataType: 'conversation' | 'summary' | 'extraction'): Promise<MedicalEncryptionResult> {
    if (!this.encryptionKey) {
      return { success: false, error: 'Medical encryption key not initialized' }
    }

    try {
      const dataString = JSON.stringify(data)
      const encoder = new TextEncoder()
      const encoded = encoder.encode(dataString)
      const iv = crypto.getRandomValues(new Uint8Array(12))
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        encoded
      )
      
      const encryptedData: EncryptedMedicalData = {
        data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        iv: btoa(String.fromCharCode(...iv)),
        timestamp: Date.now(),
        version: this.VERSION,
        dataType
      }
      
      const result = btoa(JSON.stringify(encryptedData))
      return { success: true, encryptedData: result }
    } catch (error) {
      console.error('Medical data encryption failed:', error)
      return { success: false, error: 'Failed to encrypt medical data' }
    }
  }

  // Decrypt medical data
  async decryptMedicalData(encryptedString: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.encryptionKey) {
      return { success: false, error: 'Medical encryption key not initialized' }
    }

    try {
      const encryptedData: EncryptedMedicalData = JSON.parse(atob(encryptedString))
      
      // Version check
      if (encryptedData.version !== this.VERSION) {
        return { success: false, error: 'Incompatible medical data version' }
      }
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0)) },
        this.encryptionKey,
        Uint8Array.from(atob(encryptedData.data), c => c.charCodeAt(0))
      )
      
      const result = new TextDecoder().decode(decrypted)
      return { success: true, data: JSON.parse(result) }
    } catch (error) {
      console.error('Medical data decryption failed:', error)
      return { success: false, error: 'Failed to decrypt medical data' }
    }
  }

  // Store encrypted medical conversation
  async storeEncryptedConversation(conversation: any): Promise<MedicalEncryptionResult> {
    const result = await this.encryptMedicalData(conversation, 'conversation')
    if (result.success) {
      try {
        localStorage.setItem('medical_translator_encrypted_conversations', result.encryptedData!)
        return { success: true }
      } catch (error) {
        return { success: false, error: 'Failed to store encrypted conversation' }
      }
    }
    return result
  }

  // Get encrypted medical conversations
  async getEncryptedConversations(): Promise<any[]> {
    try {
      const encrypted = localStorage.getItem('medical_translator_encrypted_conversations')
      if (!encrypted) return []

      const result = await this.decryptMedicalData(encrypted)
      if (result.success) {
        return Array.isArray(result.data) ? result.data : []
      }
      return []
    } catch (error) {
      console.error('Failed to get encrypted conversations:', error)
      return []
    }
  }

  // Store encrypted medical summary
  async storeEncryptedSummary(summary: any): Promise<MedicalEncryptionResult> {
    const result = await this.encryptMedicalData(summary, 'summary')
    if (result.success) {
      try {
        localStorage.setItem('medical_translator_encrypted_summaries', result.encryptedData!)
        return { success: true }
      } catch (error) {
        return { success: false, error: 'Failed to store encrypted summary' }
      }
    }
    return result
  }

  // Get encrypted medical summaries
  async getEncryptedSummaries(): Promise<any[]> {
    try {
      const encrypted = localStorage.getItem('medical_translator_encrypted_summaries')
      if (!encrypted) return []

      const result = await this.decryptMedicalData(encrypted)
      if (result.success) {
        return Array.isArray(result.data) ? result.data : []
      }
      return []
    } catch (error) {
      console.error('Failed to get encrypted summaries:', error)
      return []
    }
  }

  // Clear all encrypted medical data
  async clearAllMedicalData(): Promise<void> {
    try {
      localStorage.removeItem('medical_translator_encrypted_conversations')
      localStorage.removeItem('medical_translator_encrypted_summaries')
      localStorage.removeItem('medical_translator_encrypted_extractions')
      console.log('All encrypted medical data cleared')
    } catch (error) {
      console.error('Failed to clear medical data:', error)
    }
  }

  // Check if medical encryption is available
  static isSupported(): boolean {
    return 'crypto' in window && 
           'subtle' in crypto && 
           'localStorage' in window
  }

  // Get encryption status
  async getStatus(): Promise<{
    initialized: boolean
    supported: boolean
    keyExists: boolean
    lastAccess: number
  }> {
    return {
      initialized: this.encryptionKey !== null,
      supported: MedicalEncryption.isSupported(),
      keyExists: localStorage.getItem(this.MEDICAL_KEY_NAME) !== null,
      lastAccess: Date.now()
    }
  }
}

// Export singleton instance
export const medicalEncryption = MedicalEncryption.getInstance()
