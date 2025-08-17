// Secure storage utilities for API keys
// Uses Web Crypto API to encrypt sensitive data before storing in localStorage

export interface EncryptedData {
  data: string
  iv: string
  timestamp: number
  version: string
}

export interface StorageResult {
  success: boolean
  error?: string
}

class SecureStorage {
  private static instance: SecureStorage
  private encryptionKey: CryptoKey | null = null
  private readonly KEY_NAME = 'medical_translator_encryption_key'
  private readonly STORAGE_PREFIX = 'encrypted_'
  private readonly VERSION = '1.0'
  private readonly KEY_EXPIRY_DAYS = 30

  private constructor() {}

  static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage()
    }
    return SecureStorage.instance
  }

  // Initialize encryption key
  async initialize(): Promise<boolean> {
    try {
      // Check if we already have a key
      const existingKey = await this.getOrCreateKey()
      if (existingKey) {
        this.encryptionKey = existingKey
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to initialize secure storage:', error)
      return false
    }
  }

  // Get or create encryption key
  private async getOrCreateKey(): Promise<CryptoKey | null> {
    try {
      // Try to get existing key from IndexedDB or generate new one
      const keyData = await this.getKeyFromStorage()
      
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
        await this.storeKey(exportedKey)
        
        return newKey
      }
    } catch (error) {
      console.error('Error getting/creating encryption key:', error)
      return null
    }
  }

  // Store encryption key securely
  private async storeKey(keyData: ArrayBuffer): Promise<void> {
    try {
      // Store in IndexedDB for better security than localStorage
      const db = await this.openIndexedDB()
      const transaction = db.transaction(['keys'], 'readwrite')
      const store = transaction.objectStore('keys')
      
      await store.put({
        name: this.KEY_NAME,
        data: Array.from(new Uint8Array(keyData)),
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('Failed to store encryption key:', error)
      // Fallback to localStorage (less secure but functional)
      const keyString = btoa(String.fromCharCode(...new Uint8Array(keyData)))
      localStorage.setItem(this.KEY_NAME, keyString)
    }
  }

  // Get encryption key from storage
  private async getKeyFromStorage(): Promise<ArrayBuffer | null> {
    try {
      // Try IndexedDB first
      const db = await this.openIndexedDB()
      const transaction = db.transaction(['keys'], 'readonly')
      const store = transaction.objectStore('keys')
      const result = await store.get(this.KEY_NAME)
      
      if (result && this.isKeyValid(result.timestamp)) {
        return new Uint8Array(result.data).buffer
      }
    } catch (error) {
      console.warn('IndexedDB not available, trying localStorage fallback')
    }
    
    // Fallback to localStorage
    try {
      const keyString = localStorage.getItem(this.KEY_NAME)
      if (keyString) {
        const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0))
        return keyData.buffer
      }
    } catch (error) {
      console.error('Failed to get key from localStorage:', error)
    }
    
    return null
  }

  // Check if key is still valid (not expired)
  private isKeyValid(timestamp: number): boolean {
    const expiryTime = timestamp + (this.KEY_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    return Date.now() < expiryTime
  }

  // Open IndexedDB
  private async openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MedicalTranslatorDB', 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys', { keyPath: 'name' })
        }
      }
    })
  }

  // Encrypt data
  async encrypt(data: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized')
    }

    try {
      const encoder = new TextEncoder()
      const encoded = encoder.encode(data)
      const iv = crypto.getRandomValues(new Uint8Array(12))
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        encoded
      )
      
      const encryptedData: EncryptedData = {
        data: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv),
        timestamp: Date.now(),
        version: this.VERSION
      }
      
      return btoa(JSON.stringify(encryptedData))
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  // Decrypt data
  async decrypt(encryptedString: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized')
    }

    try {
      const encryptedData: EncryptedData = JSON.parse(atob(encryptedString))
      
      // Version check
      if (encryptedData.version !== this.VERSION) {
        throw new Error('Incompatible data version')
      }
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
        this.encryptionKey,
        new Uint8Array(encryptedData.data)
      )
      
      return new TextDecoder().decode(decrypted)
    } catch (error) {
      console.error('Decryption failed:', error)
      throw new Error('Failed to decrypt data')
    }
  }

  // Store encrypted API key
  async storeApiKey(name: string, key: string): Promise<StorageResult> {
    try {
      // Validate input
      if (!name.trim() || !key.trim()) {
        return { success: false, error: 'Name and key are required' }
      }
      
      // Sanitize name
      const sanitizedName = name.trim().replace(/[<>\"'&]/g, '')
      if (sanitizedName !== name.trim()) {
        return { success: false, error: 'Invalid characters in name' }
      }
      
      // Encrypt the API key
      const encryptedKey = await this.encrypt(key)
      
      // Store encrypted data
      const storageKey = `${this.STORAGE_PREFIX}${sanitizedName}`
      localStorage.setItem(storageKey, encryptedKey)
      
      return { success: true }
    } catch (error) {
      console.error('Failed to store API key:', error)
      return { success: false, error: 'Failed to store API key securely' }
    }
  }

  // Retrieve API key
  async getApiKey(name: string): Promise<string | null> {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${name}`
      const encryptedData = localStorage.getItem(storageKey)
      
      if (!encryptedData) {
        return null
      }
      
      // Try to decrypt with current key
      try {
        return await this.decrypt(encryptedData)
      } catch (decryptError) {
        console.warn(`Failed to decrypt API key ${name}, removing corrupted data`)
        // Remove corrupted data
        localStorage.removeItem(storageKey)
        return null
      }
    } catch (error) {
      console.error('Failed to retrieve API key:', error)
      return null
    }
  }

  // Remove API key
  async removeApiKey(name: string): Promise<StorageResult> {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${name}`
      localStorage.removeItem(storageKey)
      return { success: true }
    } catch (error) {
      console.error('Failed to remove API key:', error)
      return { success: false, error: 'Failed to remove API key' }
    }
  }

  // List all stored API keys
  async listApiKeys(): Promise<string[]> {
    try {
      const keys: string[] = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          const name = key.replace(this.STORAGE_PREFIX, '')
          keys.push(name)
        }
      }
      
      return keys
    } catch (error) {
      console.error('Failed to list API keys:', error)
      return []
    }
  }

  // Clear all encrypted data
  async clearAll(): Promise<StorageResult> {
    try {
      const keys = await this.listApiKeys()
      
      for (const key of keys) {
        await this.removeApiKey(key)
      }
      
      // Also clear the encryption key
      localStorage.removeItem(this.KEY_NAME)
      
      return { success: true }
    } catch (error) {
      console.error('Failed to clear all data:', error)
      return { success: false, error: 'Failed to clear all data' }
    }
  }

  // Clear corrupted data and reset encryption
  async resetEncryption(): Promise<StorageResult> {
    try {
      // Clear all encrypted data
      await this.clearAll()
      
      // Reset encryption key
      this.encryptionKey = null
      
      // Reinitialize with new key
      const initialized = await this.initialize()
      
      return { 
        success: initialized, 
        error: initialized ? undefined : 'Failed to reinitialize encryption'
      }
    } catch (error) {
      console.error('Failed to reset encryption:', error)
      return { success: false, error: 'Failed to reset encryption' }
    }
  }

  // Check if secure storage is available
  static isSupported(): boolean {
    return 'crypto' in window && 
           'subtle' in crypto && 
           'localStorage' in window &&
           'indexedDB' in window
  }

  // Get storage status
  async getStatus(): Promise<{
    initialized: boolean
    supported: boolean
    keyCount: number
    lastAccess: number
  }> {
    const keys = await this.listApiKeys()
    return {
      initialized: this.encryptionKey !== null,
      supported: SecureStorage.isSupported(),
      keyCount: keys.length,
      lastAccess: Date.now()
    }
  }
}

// Export singleton instance
export const secureStorage = SecureStorage.getInstance()

// Migration helper for existing localStorage API keys
export async function migrateExistingKeys(): Promise<{
  migrated: number
  failed: number
  errors: string[]
}> {
  const result = { migrated: 0, failed: 0, errors: [] }
  
  try {
    // Check for existing unencrypted API keys
    const existingKeys = localStorage.getItem('api_keys')
    if (existingKeys) {
      try {
        const keys = JSON.parse(existingKeys)
        
        for (const [name, key] of Object.entries(keys)) {
          try {
            const success = await secureStorage.storeApiKey(name, key as string)
            if (success.success) {
              result.migrated++
            } else {
              result.failed++
              result.errors.push(`Failed to migrate ${name}: ${success.error}`)
            }
          } catch (error) {
            result.failed++
            result.errors.push(`Error migrating ${name}: ${error}`)
          }
        }
        
        // Remove old unencrypted keys after successful migration
        if (result.migrated > 0) {
          localStorage.removeItem('api_keys')
        }
      } catch (parseError) {
        // If JSON parsing fails, remove corrupted data
        console.warn('Corrupted api_keys data found, removing')
        localStorage.removeItem('api_keys')
        result.errors.push('Corrupted existing API keys data removed')
      }
    }
    
    // Also clean up any corrupted encrypted keys
    const allKeys = Object.keys(localStorage)
    const encryptedKeys = allKeys.filter(key => key.startsWith('encrypted_'))
    
    for (const key of encryptedKeys) {
      try {
        const name = key.replace('encrypted_', '')
        await secureStorage.getApiKey(name)
      } catch (error) {
        // Remove corrupted encrypted key
        console.warn(`Removing corrupted encrypted key: ${key}`)
        localStorage.removeItem(key)
        result.errors.push(`Removed corrupted key: ${name}`)
      }
    }
  } catch (error) {
    result.errors.push(`Migration failed: ${error}`)
  }
  
  return result
}
