import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { secureStorage, migrateExistingKeys } from '../utils/secureStorage'

export interface Provider {
  id: string
  name: string
  type: 'local' | 'cloud' | 'api'
  status: 'available' | 'unavailable'
}

export const useApiKeys = () => {
  const [providers] = useState<Provider[]>([
    { id: 'openai', name: 'OpenAI GPT-3.5', type: 'cloud', status: 'available' },
    { id: 'mymemory', name: 'MyMemory (Free)', type: 'api', status: 'available' },
    { id: 'google', name: 'Google Translate', type: 'cloud', status: 'available' },
    { id: 'deepl', name: 'DeepL (Free Tier)', type: 'cloud', status: 'available' }
  ])
  const [selectedProvider, setSelectedProvider] = useState('openai')
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [apiKeyNames, setApiKeyNames] = useState<Record<string, string[]>>({})
  const [selectedApiKey, setSelectedApiKey] = useState<string>('')
  const [newApiKey, setNewApiKey] = useState<string>('')
  const [newApiKeyName, setNewApiKeyName] = useState<string>('')
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [showApiKeyDropdown, setShowApiKeyDropdown] = useState(false)

  // Load API keys from secure storage on component mount
  useEffect(() => {
    const initializeSecureStorage = async () => {
      try {
        // Initialize secure storage
        const initialized = await secureStorage.initialize()
        
        if (initialized) {
          // Migrate existing keys if any
          const migration = await migrateExistingKeys()
          if (migration.migrated > 0) {
            toast.success(`Migrated ${migration.migrated} API keys to secure storage`)
          }
          if (migration.failed > 0) {
            toast.error(`Some API keys could not be migrated: ${migration.errors.join(', ')}`)
          }
          
          // Load encrypted keys
          const keyNames = await secureStorage.listApiKeys()
          console.log('🔑 Found stored API keys:', keyNames)
          const loadedKeys: Record<string, string> = {}
          const loadedKeyNames: Record<string, string[]> = {}
          
          for (const name of keyNames) {
            const key = await secureStorage.getApiKey(name)
            if (key) {
              loadedKeys[name] = key
              // Try to get provider info from the key name or assume it's for the current provider
              // Key names should be in format: "provider_name" or just "name"
              const keyParts = name.split('_')
              const provider = keyParts.length > 1 ? keyParts[0] : selectedProvider
              
              if (!loadedKeyNames[provider]) {
                loadedKeyNames[provider] = []
              }
              loadedKeyNames[provider].push(name)
            }
          }
          
          console.log('🔑 Loaded API keys:', loadedKeys)
          console.log('🔑 Loaded API key names by provider:', loadedKeyNames)
          setApiKeys(loadedKeys)
          setApiKeyNames(loadedKeyNames)
        } else {
          toast.error('Failed to initialize secure storage')
        }
      } catch (error) {
        console.error('Error initializing secure storage:', error)
        
        // Try to reset encryption if there are persistent errors
        try {
          const resetResult = await secureStorage.resetEncryption()
          if (resetResult.success) {
            toast.success('Secure storage reset successfully')
          } else {
            toast.error('Secure storage reset failed')
          }
        } catch (resetError) {
          console.error('Failed to reset secure storage:', resetError)
          toast.error('Secure storage initialization failed')
        }
      }
    }
    
    initializeSecureStorage()
  }, [selectedProvider]) // Empty dependency array ensures this runs only once on mount

  // Save API key to secure storage
  const saveApiKeyToStorage = useCallback(async (name: string, key: string) => {
    try {
      // Create a provider-aware key name
      const providerKeyName = `${selectedProvider}_${name}`
      console.log('🔑 Saving API key:', { provider: selectedProvider, name, providerKeyName })
      
      const result = await secureStorage.storeApiKey(providerKeyName, key)
      if (result.success) {
        setApiKeys(prev => ({ ...prev, [providerKeyName]: key }))
        setApiKeyNames(prev => ({
          ...prev,
          [selectedProvider]: [...(prev[selectedProvider] || []), providerKeyName]
        }))
        setNewApiKey('')
        setNewApiKeyName('')
        setShowApiKeyInput(false)
        setSelectedApiKey(providerKeyName)
        toast.success('API key saved successfully')
      } else {
        toast.error(`Failed to save API key: ${result.error}`)
      }
    } catch (error) {
      console.error('Error saving API key:', error)
      toast.error('Failed to save API key')
    }
  }, [selectedProvider])

  // Delete API key
  const deleteApiKey = useCallback(async (name: string) => {
    if (!window.confirm(`Are you sure you want to delete the API key "${name}"?`)) {
      return
    }
    
    try {
      const result = await secureStorage.removeApiKey(name)
      if (result.success) {
        setApiKeys(prev => {
          const newKeys = { ...prev }
          delete newKeys[name]
          return newKeys
        })
        setApiKeyNames(prev => ({
          ...prev,
          [selectedProvider]: (prev[selectedProvider] || []).filter(keyName => keyName !== name)
        }))
        if (selectedApiKey === name) {
          setSelectedApiKey('')
        }
        toast.success('API key deleted successfully')
      } else {
        toast.error(`Failed to delete API key: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting API key:', error)
      toast.error('Failed to delete API key')
    }
  }, [selectedProvider, selectedApiKey])

  // Edit API key
  const editApiKey = useCallback((name: string) => {
    setNewApiKeyName(name)
    setNewApiKey(apiKeys[name] || '')
    setShowApiKeyInput(true)
  }, [apiKeys])

  // Check if any API key is available
  const checkApiKeyAvailability = useCallback(() => {
    const availableProviders = Object.keys(apiKeyNames).filter(provider => 
      apiKeyNames[provider] && apiKeyNames[provider].length > 0
    )
    return availableProviders
  }, [apiKeyNames])

  // Function to automatically select the best available API key
  const autoSelectApiKey = useCallback(() => {
    const availableProviders = checkApiKeyAvailability()
    if (availableProviders.length > 0) {
      // Prefer OpenAI, then Google, then others
      const preferredOrder = ['openai', 'google', 'deepl', 'mymemory']
      const bestProvider = preferredOrder.find(provider => availableProviders.includes(provider)) || availableProviders[0]
      
      setSelectedProvider(bestProvider)
      const firstKeyName = apiKeyNames[bestProvider][0]
      setSelectedApiKey(firstKeyName)
      
      console.log(`🤖 Auto-selected API key: ${bestProvider} - ${firstKeyName}`)
      return true
    }
    return false
  }, [apiKeyNames, checkApiKeyAvailability])

  // Check if provider is cloud-based
  const isCloudProvider = useCallback((providerId: string) => {
    return ['openai', 'google', 'deepl'].includes(providerId)
  }, [])

  // Get API key names for current provider
  const getApiKeyNamesForProvider = useCallback((providerId: string) => {
    return apiKeyNames[providerId] || []
  }, [apiKeyNames])

  return {
    providers,
    selectedProvider,
    setSelectedProvider,
    apiKeys,
    apiKeyNames,
    selectedApiKey,
    setSelectedApiKey,
    newApiKey,
    setNewApiKey,
    newApiKeyName,
    setNewApiKeyName,
    showApiKeyInput,
    setShowApiKeyInput,
    showApiKeyDropdown,
    setShowApiKeyDropdown,
    saveApiKeyToStorage,
    deleteApiKey,
    editApiKey,
    checkApiKeyAvailability,
    autoSelectApiKey,
    isCloudProvider,
    getApiKeyNamesForProvider
  }
}
