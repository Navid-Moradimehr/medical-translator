import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

// Import modular components
import {
  Header,
  RoleSwitcher,
  RecordingControls,
  LanguageSelector,
  ManualTextInput,
  StatusIndicator,
  ConversationDisplay,
  SettingsPanel,
  SaveDialog,
  LoadDialog,
  DeleteDialog,
  MedicalSummaryModal,
  ConversationSummaryModal
} from './components'

import { sanitizeInput, encodeOutput } from './utils/security'
import { 
  ScreenReader, 
  createSkipLink
} from './utils/accessibility.tsx'
import { secureStorage, migrateExistingKeys } from './utils/secureStorage'
import { hipaaCompliance, createPrivacyConsentDialog } from './utils/hipaa'
import MedicalExtractionService, { type MedicalExtraction } from './utils/medicalExtraction'
import { medicalEncryption } from './utils/medicalEncryption'

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

interface Message {
  id: string
  text: string
  translatedText: string
  isDoctor: boolean
  timestamp: Date
  language: string
  rating?: number // 0-5 stars for translation quality
  translationQuality?: 'poor' | 'fair' | 'good' | 'excellent'
}

interface Provider {
  id: string
  name: string
  type: 'local' | 'cloud' | 'api'
  status: 'available' | 'unavailable'
}

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentLanguage, setCurrentLanguage] = useState('es') // Spanish
  const [sourceLanguage, setSourceLanguage] = useState('en-US') // Source language for speech recognition
  const [isDoctor, setIsDoctor] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  // const [isOnline] = useState(true) // Removed - no longer needed
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
  const [manualText, setManualText] = useState<string>('')
  const [showManualInput, setShowManualInput] = useState(false)
  const [messageRatings, setMessageRatings] = useState<Record<string, number>>({})
  // const [showRatingPrompt, setShowRatingPrompt] = useState<string | null>(null)
  // const [translationQuality, setTranslationQuality] = useState<{
  //   averageRating: number
  //   totalRatings: number
  //   qualityLevel: 'poor' | 'fair' | 'good' | 'excellent'
  // }>({ averageRating: 0, totalRatings: 0, qualityLevel: 'good' })
  
  // Medical extraction state
  const [medicalExtraction, setMedicalExtraction] = useState<MedicalExtraction | null>(null)
  // const [showMedicalSummary, setShowMedicalSummary] = useState(false)
  const [aiStatus, setAiStatus] = useState<'active' | 'inactive' | 'checking'>('checking')
  const [aiMode, setAiMode] = useState<'basic' | 'ai'>('basic')
  const [activeModel, setActiveModel] = useState<string>('')
  const [showMedicalSummaryModal, setShowMedicalSummaryModal] = useState(false)
  const [showConversationSummaryModal, setShowConversationSummaryModal] = useState(false)
  const [showRatingPrompt, setShowRatingPrompt] = useState<string | null>(null)
  const [translationQuality, setTranslationQuality] = useState<{
    averageRating: number
    totalRatings: number
    qualityLevel: 'poor' | 'fair' | 'good' | 'excellent'
  }>({ averageRating: 0, totalRatings: 0, qualityLevel: 'good' })
  
  // Real-time conversation summary state
  const [conversationSummary, setConversationSummary] = useState<{
    keyPoints: string[]
    medicalFindings: string[]
    recommendations: string[]
    urgency: 'routine' | 'urgent' | 'emergency'
    nextSteps: string[]
    confidence: number
    lastUpdated: Date | null
  } | null>(null)
  // const [showConversationSummary, setShowConversationSummary] = useState(false)

  // Hamburger menu and saved cases state
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [saveMode, setSaveMode] = useState<'new' | 'existing'>('new')
  const [newFileName, setNewFileName] = useState('')
  const [selectedFileToOverwrite, setSelectedFileToOverwrite] = useState('')
  const [selectedFileToLoad, setSelectedFileToLoad] = useState('')
  const [selectedFileToDelete, setSelectedFileToDelete] = useState('')
  const [savedCases, setSavedCases] = useState<Array<{
    id: string
    name: string
    timestamp: string
    messages: Message[]
    medicalExtraction: MedicalExtraction | null
    conversationSummary: any
    encrypted?: boolean
    encryptedData?: string
  }>>([])

  // Simple language switching: just swap the languages when role changes
  const autoSwitchLanguages = (_newIsDoctor: boolean) => {
    // Get the base language codes for proper swapping
    const currentSourceBase = sourceLanguage.split('-')[0] // e.g., 'en-US' -> 'en'
    const currentTargetBase = currentLanguage // e.g., 'es'
    
    // Map short codes to full codes for source language
    const languageToFullCode: Record<string, string> = {
      'en': 'en-US',
      'es': 'es-ES', 
      'pt': 'pt-BR',
      'fa': 'fa-IR',
      'ar': 'ar-SA',
      'zh': 'zh-CN',
      'fr': 'fr-FR',
      'de': 'de-DE'
    }
    
    // Map full codes to short codes for target language
    const fullCodeToLanguage: Record<string, string> = {
      'en-US': 'en',
      'es-ES': 'es',
      'pt-BR': 'pt', 
      'fa-IR': 'fa',
      'ar-SA': 'ar',
      'zh-CN': 'zh',
      'fr-FR': 'fr',
      'de-DE': 'de'
    }
    
    // Swap the languages with proper code conversion
    setSourceLanguage(languageToFullCode[currentTargetBase] || currentTargetBase)
    setCurrentLanguage(fullCodeToLanguage[sourceLanguage] || currentSourceBase)
  }

  // Load saved cases from localStorage on component mount
  useEffect(() => {
    const loadSavedCases = () => {
      try {
        const saved = localStorage.getItem('medical_translator_saved_cases')
        console.log('📂 Loading saved cases from localStorage:', saved)
        if (saved && saved !== '[]') {
          const cases = JSON.parse(saved)
          console.log('📂 Parsed cases:', cases)
          if (Array.isArray(cases) && cases.length > 0) {
            setSavedCases(cases)
          }
        }
      } catch (error) {
        console.error('Failed to load saved cases:', error)
      }
    }
    loadSavedCases()
  }, [])

  // Initialize AI mode when API keys are loaded
  useEffect(() => {
    if (Object.keys(apiKeyNames).length > 0) {
      const availableProviders = checkApiKeyAvailability()
      if (availableProviders.length > 0) {
        // Auto-enable AI mode if API keys are available
        const hasApiKey = autoSelectApiKey()
        if (hasApiKey) {
          setAiMode('ai')
          setAiStatus('active')
          console.log('🤖 Auto-enabled AI mode with available API key')
        } else {
          setAiMode('basic')
          setAiStatus('inactive')
          console.log('🔧 No valid API keys found, staying in basic mode')
        }
      } else {
        setAiMode('basic')
        setAiStatus('inactive')
        console.log('🔧 No API keys available, staying in basic mode')
      }
    }
  }, [apiKeyNames])

  // Function to refresh saved cases from localStorage
  const refreshSavedCases = () => {
    try {
      const saved = localStorage.getItem('medical_translator_saved_cases')
      console.log('🔄 Refreshing saved cases from localStorage:', saved)
      if (saved && saved !== '[]') {
        const cases = JSON.parse(saved)
        console.log('🔄 Refreshed cases:', cases)
        if (Array.isArray(cases) && cases.length > 0) {
          setSavedCases(cases)
        } else {
          console.log('🔄 No valid cases found in localStorage')
        }
      } else {
        console.log('🔄 No saved cases found in localStorage')
      }
    } catch (error) {
      console.error('Failed to refresh saved cases:', error)
    }
  }



  // Function to check if any API key is available
  const checkApiKeyAvailability = () => {
    const availableProviders = Object.keys(apiKeyNames).filter(provider => 
      apiKeyNames[provider] && apiKeyNames[provider].length > 0
    )
    return availableProviders
  }

  // Function to automatically select the best available API key
  const autoSelectApiKey = () => {
    const availableProviders = checkApiKeyAvailability()
    if (availableProviders.length > 0) {
      // Prefer OpenAI, then Google, then others
      const preferredOrder = ['openai', 'google', 'deepl', 'mymemory']
      const bestProvider = preferredOrder.find(provider => availableProviders.includes(provider)) || availableProviders[0]
      
      setSelectedProvider(bestProvider)
      const firstKeyName = apiKeyNames[bestProvider][0]
      setSelectedApiKey(firstKeyName)
      setActiveModel(`${bestProvider.toUpperCase()} (${firstKeyName})`)
      
      console.log(`🤖 Auto-selected API key: ${bestProvider} - ${firstKeyName}`)
      return true
    }
    return false
  }

  // Function to toggle AI mode
  const toggleAiMode = () => {
    if (aiMode === 'basic') {
      // Switching to AI mode
      const hasApiKey = autoSelectApiKey()
      if (hasApiKey) {
        setAiMode('ai')
        setAiStatus('active')
        toast.success(`Switched to AI Mode - ${activeModel}`)
      } else {
        toast.error('No API keys available. Please add an API key in settings.')
      }
    } else {
      // Switching to basic mode
      setAiMode('basic')
      setAiStatus('inactive')
      setActiveModel('')
      toast.success('Switched to Basic Mode')
    }
  }

  // Save cases to localStorage whenever savedCases changes
  useEffect(() => {
    console.log('💾 Saving cases to localStorage:', savedCases)
    try {
      // Only save if we have actual cases or if this is the initial load
      if (savedCases.length > 0 || localStorage.getItem('medical_translator_saved_cases') === null) {
        localStorage.setItem('medical_translator_saved_cases', JSON.stringify(savedCases))
        console.log('✅ Cases saved to localStorage successfully')
      } else {
        console.log('⏭️ Skipping save - no cases to save and not initial load')
      }
    } catch (error) {
      console.error('❌ Failed to save cases to localStorage:', error)
    }
  }, [savedCases])

  // Save current conversation and medical data
  const saveCurrentCase = async (fileName: string, overwriteId?: string) => {
    const caseData = {
      id: overwriteId || `case_${Date.now()}`,
      name: fileName,
      timestamp: new Date().toISOString(),
      messages: messages,
      medicalExtraction: medicalExtraction,
      conversationSummary: conversationSummary
    }

    console.log('💾 Saving case:', caseData)

    try {
      // Encrypt medical data before saving
      const encryptionResult = await medicalEncryption.encryptMedicalData(caseData, 'conversation')
      if (!encryptionResult.success) {
        console.error('Failed to encrypt case data:', encryptionResult.error)
        toast.error('Failed to encrypt case data')
        return
      }

      // Create encrypted case data
      const encryptedCaseData = {
        ...caseData,
        encrypted: true,
        encryptedData: encryptionResult.encryptedData
      }

      // Log the save operation for audit
      hipaaCompliance.logAuditEntry('case_saved', caseData, {
        dataType: 'conversation',
        severity: 'medium',
        details: { fileName, overwriteId, encrypted: true }
      })

      if (overwriteId) {
        // Update existing case
        setSavedCases(prev => {
          const updated = prev.map(case_ => 
            case_.id === overwriteId ? encryptedCaseData : case_
          )
          console.log('📝 Updated cases:', updated)
          return updated
        })
        toast.success('Case updated successfully!')
      } else {
        // Save new case
        setSavedCases(prev => {
          const updated = [encryptedCaseData, ...prev]
          console.log('📝 New cases list:', updated)
          return updated
        })
        toast.success('Case saved successfully!')
      }
      
      setShowSaveDialog(false)
      setNewFileName('')
      setSelectedFileToOverwrite('')
    } catch (error) {
      console.error('Error saving case:', error)
      toast.error('Failed to save case')
      hipaaCompliance.logAuditEntry('case_save_failed', caseData, {
        dataType: 'conversation',
        severity: 'high',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Load a saved case
  const loadCase = async (caseId: string) => {
    console.log('📂 Loading case with ID:', caseId)
    console.log('📂 Available cases:', savedCases)
    const caseToLoad = savedCases.find(case_ => case_.id === caseId)
    if (caseToLoad) {
      console.log('📂 Found case to load:', caseToLoad)
      
      try {
        // Decrypt medical data if it's encrypted
        let decryptedData = caseToLoad
        if (caseToLoad.encrypted && caseToLoad.encryptedData) {
          const decryptionResult = await medicalEncryption.decryptMedicalData(caseToLoad.encryptedData)
          if (!decryptionResult.success) {
            console.error('Failed to decrypt case data:', decryptionResult.error)
            toast.error('Failed to decrypt case data')
            return
          }
          decryptedData = decryptionResult.data
        }
        
        // Convert timestamp strings back to Date objects for messages
        const messagesWithDates = decryptedData.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
        
        setMessages(messagesWithDates)
        setMedicalExtraction(decryptedData.medicalExtraction)
        setConversationSummary(decryptedData.conversationSummary)
        setShowLoadDialog(false)
        setSelectedFileToLoad('')
        
        // Log the load operation for audit
        hipaaCompliance.logAuditEntry('case_loaded', decryptedData, {
          dataType: 'conversation',
          severity: 'low',
          details: { caseId, caseName: caseToLoad.name }
        })
        
        toast.success(`Loaded case: ${caseToLoad.name}`)
      } catch (error) {
        console.error('Error loading case:', error)
        toast.error('Failed to load case')
        hipaaCompliance.logAuditEntry('case_load_failed', null, {
          dataType: 'conversation',
          severity: 'high',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } else {
      console.error('❌ Case not found:', caseId)
      toast.error('Case not found!')
    }
  }

  // Clear current conversation
  const clearConversation = () => {
    setMessages([])
    setMedicalExtraction(null)
    setConversationSummary(null)
    setShowHamburgerMenu(false)
    toast.success('Conversation cleared!')
  }

  // Delete a saved case
  const deleteCase = (caseId: string) => {
    setSavedCases(prev => prev.filter(case_ => case_.id !== caseId))
    setShowDeleteDialog(false)
    setSelectedFileToDelete('')
    toast.success('Case deleted successfully!')
  }

  // Close hamburger menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (showHamburgerMenu && !target.closest('.hamburger-menu')) {
        setShowHamburgerMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showHamburgerMenu])

  // Enhanced role switching with automatic language switching
  const switchRole = (newIsDoctor: boolean) => {
    setIsDoctor(newIsDoctor)
    autoSwitchLanguages(newIsDoctor)
    ScreenReader.announceRoleSwitch(newIsDoctor)
    hipaaCompliance.logAuditEntry('role_switch', { role: newIsDoctor ? 'doctor' : 'patient' })
  }

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
  }, []) // Empty dependency array ensures this runs only once on mount

  // Initialize HIPAA compliance and privacy settings
  useEffect(() => {
    // Initialize privacy settings
    hipaaCompliance.initializePrivacySettings()
    
    // Check if consent is needed
    const consent = hipaaCompliance.getConsent()
    if (!Object.values(consent).some(Boolean)) {
      // Show privacy consent dialog
      const dialog = createPrivacyConsentDialog(
        () => {
          toast.success('Privacy settings configured')
          hipaaCompliance.logAuditEntry('privacy_consent_given')
        },
        () => {
          toast.success('Using minimal privacy settings')
          hipaaCompliance.logAuditEntry('privacy_consent_declined')
        }
      )
      document.body.appendChild(dialog)
    }
    
    // Auto-delete expired data
    hipaaCompliance.autoDeleteExpiredData()
    
    // Log app initialization
    hipaaCompliance.logAuditEntry('app_initialized')
  }, [])

  // Initialize medical encryption
  useEffect(() => {
    const initializeMedicalEncryption = async () => {
      try {
        const initialized = await medicalEncryption.initialize()
        if (initialized) {
          console.log('🔐 Medical encryption initialized successfully')
          hipaaCompliance.logAuditEntry('medical_encryption_initialized', null, {
            dataType: 'settings',
            severity: 'medium',
            success: true
          })
        } else {
          console.error('Failed to initialize medical encryption')
          hipaaCompliance.logAuditEntry('medical_encryption_failed', null, {
            dataType: 'settings',
            severity: 'high',
            success: false,
            errorMessage: 'Medical encryption initialization failed'
          })
        }
      } catch (error) {
        console.error('Error initializing medical encryption:', error)
        hipaaCompliance.logAuditEntry('medical_encryption_error', null, {
          dataType: 'settings',
          severity: 'critical',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    initializeMedicalEncryption()
  }, [])

  // Save API keys to secure storage
  const saveApiKey = async (name: string, key: string) => {
    try {
      const result = await secureStorage.storeApiKey(name, key)
      
      if (result.success) {
        const updatedKeys = { ...apiKeys, [name]: key }
        setApiKeys(updatedKeys)
        setNewApiKey('')
        toast.success('API key saved securely!')
      } else {
        toast.error(`Failed to save API key: ${result.error}`)
      }
    } catch (error) {
      console.error('Error saving API key:', error)
      toast.error('Failed to save API key securely')
    }
  }

  // Remove API key
  const removeApiKey = async (name: string) => {
    try {
      const result = await secureStorage.removeApiKey(name)
      
      if (result.success) {
        const updatedKeys = { ...apiKeys }
        delete updatedKeys[name]
        setApiKeys(updatedKeys)
        
        if (selectedApiKey === name) {
          setSelectedApiKey('')
        }
        
        toast.success('API key removed!')
      } else {
        toast.error(`Failed to remove API key: ${result.error}`)
      }
    } catch (error) {
      console.error('Error removing API key:', error)
      toast.error('Failed to remove API key')
    }
  }

  // Manual text translation
  const handleManualTranslation = async () => {
    if (!manualText.trim()) {
      toast.error('Please enter some text')
      return
    }
    
    // Sanitize input for security
    const sanitizationResult = sanitizeInput(manualText)
    
    if (!sanitizationResult.isValid) {
      toast.error(`Invalid input: ${sanitizationResult.warnings.join(', ')}`)
      return
    }
    
    if (sanitizationResult.warnings.length > 0) {
      toast.error(`Input warnings: ${sanitizationResult.warnings.join(', ')}`)
    }
    
    const translatedText = await translateText(sanitizationResult.sanitized, currentLanguage)
    
    const newMessage: Message = {
      id: Date.now().toString(),
      text: sanitizationResult.sanitized,
      translatedText: encodeOutput(translatedText), // Encode output for XSS protection
      isDoctor,
      timestamp: new Date(),
      language: currentLanguage
    }
    
    setMessages(prev => [...prev, newMessage])
    playAudio(translatedText)
    
    // Show rating prompt for patient messages
    if (!isDoctor) {
      setShowRatingPrompt(newMessage.id)
      toast.success('Translation complete! Please rate the quality below.', { duration: 4000 })
    }
    
    // Announce translation to screen readers
    ScreenReader.announceTranslation(manualText, translatedText, currentLanguage)
    
    // Log translation for audit trail
    hipaaCompliance.logAuditEntry('manual_translation', {
      sourceLanguage: sourceLanguage,
      targetLanguage: currentLanguage,
      isDoctor,
      messageCount: messages.length + 1
    })
    
    setManualText('')
    setShowManualInput(false)
  }

  // Medical dictionary for common terms (can be expanded)
  const medicalDictionary: Record<string, Record<string, string>> = {
    'en': {
      'headache': 'سردرد',
      'stomach pain': 'درد معده',
      'fever': 'تب',
      'nausea': 'تهوع',
      'dizziness': 'سرگیجه',
      'chest pain': 'درد قفسه سینه',
      'shortness of breath': 'تنگی نفس',
      'fatigue': 'خستگی',
      'cough': 'سرفه',
      'sore throat': 'گلودرد'
    },
    'fa': {
      'سردرد': 'headache',
      'درد معده': 'stomach pain',
      'تب': 'fever',
      'تهوع': 'nausea',
      'سرگیجه': 'dizziness',
      'درد قفسه سینه': 'chest pain',
      'تنگی نفس': 'shortness of breath',
      'خستگی': 'fatigue',
      'سرفه': 'cough',
      'گلودرد': 'sore throat'
    },
    'ar': {
      'صداع': 'headache',
      'ألم في المعدة': 'stomach pain',
      'حمى': 'fever',
      'غثيان': 'nausea',
      'دوار': 'dizziness',
      'ألم في الصدر': 'chest pain',
      'ضيق في التنفس': 'shortness of breath',
      'إرهاق': 'fatigue',
      'سعال': 'cough',
      'التهاب الحلق': 'sore throat'
    }
  }

  // Function to enhance text with medical dictionary
  const enhanceTextWithMedicalTerms = (text: string, sourceLang: string, targetLang: string): string => {
    // For now, return the original text without enhancement to prevent duplication
    // The medical dictionary can be used for validation but not for text enhancement
    return text
  }

  // Real translation function for MVP - supports OpenAI and free APIs
  const translateText = async (text: string, targetLang: string): Promise<string> => {
    try {
      // Determine source language from speech recognition
      const sourceLangCode = sourceLanguage.split('-')[0] // e.g., 'fa-IR' -> 'fa'
      
      // Enhance text with medical dictionary
      const enhancedText = enhanceTextWithMedicalTerms(text, sourceLangCode, targetLang)
      
      // Check if OpenAI API key is available
      const openaiKey = selectedApiKey ? apiKeys[selectedApiKey] : null
      
      if (openaiKey && selectedProvider === 'openai') {
        // Use OpenAI API for better translation quality
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `You are a medical translator. Translate the following text from ${sourceLangCode} to ${targetLang}. Keep the translation accurate and medical-appropriate.`
              },
                              {
                  role: 'user',
                  content: enhancedText
                }
            ],
            max_tokens: 150,
            temperature: 0.3
          })
        })
        
        const data = await response.json()
        if (data.choices && data.choices[0]) {
          return data.choices[0].message.content.trim()
        }
      }
      
      if (selectedProvider === 'mymemory') {
        // Use MyMemory API directly when selected
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(enhancedText)}&langpair=${sourceLangCode}|${targetLang}`)
        const data = await response.json()
        
        if (data.responseStatus === 200) {
          return data.responseData.translatedText
        }
      }
      
      if (selectedProvider === 'google' && selectedApiKey && apiKeys[selectedApiKey]) {
        // Use Google Translate API
        try {
          const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKeys[selectedApiKey]}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              q: enhancedText,
              source: sourceLangCode,
              target: targetLang,
              format: 'text'
            })
          })
          
          const data = await response.json()
          if (data.data && data.data.translations && data.data.translations[0]) {
            return data.data.translations[0].translatedText
          }
        } catch (error) {
          console.error('Google Translate API error:', error)
        }
      }
      
      if (selectedProvider === 'deepl' && selectedApiKey && apiKeys[selectedApiKey]) {
        // Use DeepL API
        try {
          const response = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: {
              'Authorization': `DeepL-Auth-Key ${apiKeys[selectedApiKey]}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              text: enhancedText,
              source_lang: sourceLangCode.toUpperCase(),
              target_lang: targetLang.toUpperCase()
            })
          })
          
          const data = await response.json()
          if (data.translations && data.translations[0]) {
            return data.translations[0].text
          }
        } catch (error) {
          console.error('DeepL API error:', error)
        }
      }
      
      // Fallback to MyMemory API if no specific provider selected or API key missing
      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(enhancedText)}&langpair=${sourceLangCode}|${targetLang}`)
      const data = await response.json()
      
      if (data.responseStatus === 200) {
        return data.responseData.translatedText
      } else {
        // Fallback to mock translations for demo
        const mockTranslations: Record<string, Record<string, string>> = {
          'en': {
            'سلام': 'Hello',
            'چطوری': 'How are you?',
            'درد دارم': 'I have pain',
            'سردرد دارم': 'I have a headache',
            'دلم درد می‌کند': 'My stomach hurts',
            'احساس سرگیجه می‌کنم': 'I feel dizzy'
          },
          'es': {
            'Hello, how are you feeling today?': 'Hola, ¿cómo se siente hoy?',
            'Do you have any pain?': '¿Tiene algún dolor?',
            'Where does it hurt?': '¿Dónde le duele?',
            'I have a headache': 'Tengo dolor de cabeza',
            'My stomach hurts': 'Me duele el estómago',
            'I feel dizzy': 'Me siento mareado',
            'سلام': 'Hola',
            'چطوری': '¿Cómo estás?',
            'درد دارم': 'Tengo dolor',
            'سردرد دارم': 'Tengo dolor de cabeza',
            'دلم درد می‌کند': 'Me duele el estómago',
            'احساس سرگیجه می‌کنم': 'Me siento mareado'
          },
          'pt': {
            'Hello, how are you feeling today?': 'Olá, como você está se sentindo hoje?',
            'Do you have any pain?': 'Você tem alguma dor?',
            'Where does it hurt?': 'Onde dói?',
            'I have a headache': 'Tenho dor de cabeça',
            'My stomach hurts': 'Meu estômago dói',
            'I feel dizzy': 'Estou tonto',
            'سلام': 'Olá',
            'چطوری': 'Como você está?',
            'درد دارم': 'Tenho dor',
            'سردرد دارم': 'Tenho dor de cabeça',
            'دلم درد می‌کند': 'Meu estômago dói',
            'احساس سرگیجه می‌کنم': 'Estou tonto'
          },
          'fa': {
            'Hello, how are you feeling today?': 'سلام، امروز چه احساسی دارید؟',
            'Do you have any pain?': 'آیا درد دارید؟',
            'Where does it hurt?': 'کجا درد می‌کند؟',
            'I have a headache': 'سردرد دارم',
            'My stomach hurts': 'دلم درد می‌کند',
            'I feel dizzy': 'احساس سرگیجه می‌کنم'
          },
          'ar': {
            'Hello, how are you feeling today?': 'مرحباً، كيف تشعر اليوم؟',
            'Do you have any pain?': 'هل تشعر بأي ألم؟',
            'Where does it hurt?': 'أين يؤلمك؟',
            'I have a headache': 'لدي صداع',
            'My stomach hurts': 'بطني تؤلمني',
            'I feel dizzy': 'أشعر بالدوار',
            'سلام': 'مرحباً',
            'چطوری': 'كيف حالك؟',
            'درد دارم': 'لدي ألم',
            'سردرد دارم': 'لدي صداع',
            'دلم درد می‌کند': 'بطني تؤلمني',
            'احساس سرگیجه می‌کنم': 'أشعر بالدوار'
          },
          'zh': {
            'Hello, how are you feeling today?': '你好，今天感觉怎么样？',
            'Do you have any pain?': '你有疼痛吗？',
            'Where does it hurt?': '哪里疼？',
            'I have a headache': '我头痛',
            'My stomach hurts': '我胃痛',
            'I feel dizzy': '我感觉头晕',
            'سلام': '你好',
            'چطوری': '你好吗？',
            'درد دارم': '我疼',
            'سردرد دارم': '我头痛',
            'دلم درد می‌کند': '我胃痛',
            'احساس سرگیجه می‌کنم': '我感觉头晕'
          }
        }
        return mockTranslations[targetLang]?.[text] || `[Translated: ${text}]`
      }
    } catch (error) {
      console.error('Translation error:', error)
      toast.error('Translation failed. Using fallback.')
      return `[Translated: ${text}]`
    }
  }

  // Store the current recognition instance for cancellation
  const recognitionRef = useRef<any>(null)

  const startRecording = async () => {
    try {
      // If already recording, stop it
      if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop()
        return
      }

      // Start new recording
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        const recognition = new SpeechRecognition()
        
        recognition.lang = sourceLanguage
        recognition.continuous = false
        recognition.interimResults = false
        
        // Store reference for cancellation
        recognitionRef.current = recognition
        
        recognition.onstart = () => {
          setIsRecording(true)
          toast.success(`Listening in ${sourceLanguage}... Click mic again to stop!`)
          console.log('Speech recognition started with language:', sourceLanguage)
          
          // Announce recording status to screen readers
          ScreenReader.announceRecordingStatus(true, sourceLanguage)
        }
        
        recognition.onresult = async (event: any) => {
          const transcript = event.results[0][0].transcript
          
          console.log('Transcript:', transcript)
          
          setIsRecording(false)
          recognitionRef.current = null
          toast.dismiss()
          
          toast.success('Processing audio...')
          
          // Sanitize speech input for security
          const sanitizationResult = sanitizeInput(transcript)
          
          if (!sanitizationResult.isValid) {
            toast.error(`Invalid speech input: ${sanitizationResult.warnings.join(', ')}`)
            return
          }
          
          if (sanitizationResult.warnings.length > 0) {
            toast.error(`Speech input warnings: ${sanitizationResult.warnings.join(', ')}`)
          }
          
          // Translate the sanitized transcript
          const translatedText = await translateText(sanitizationResult.sanitized, currentLanguage)
          
          // Add message to conversation
          const newMessage: Message = {
            id: Date.now().toString(),
            text: sanitizationResult.sanitized,
            translatedText: encodeOutput(translatedText), // Encode output for XSS protection
            isDoctor,
            timestamp: new Date(),
            language: currentLanguage
          }
          
          setMessages(prev => [...prev, newMessage])
          
          // Auto-play the translated text
          playAudio(translatedText)
          
          // Show rating prompt for patient messages
          if (!isDoctor) {
            setShowRatingPrompt(newMessage.id)
            toast.success('Translation complete! Please rate the quality below.', { duration: 4000 })
          }
          
          // Announce translation to screen readers
          ScreenReader.announceTranslation(sanitizationResult.sanitized, translatedText, currentLanguage)
          
          // Log speech translation for audit trail
          hipaaCompliance.logAuditEntry('speech_translation', {
            sourceLanguage: sourceLanguage,
            targetLanguage: currentLanguage,
            isDoctor,
            messageCount: messages.length + 1
          })
        }
        
        recognition.onerror = (event: any) => {
          setIsRecording(false)
          recognitionRef.current = null
          toast.dismiss()
          const errorMessages: Record<string, string> = {
            'no-speech': 'No speech detected. Please speak clearly.',
            'audio-capture': 'Microphone access denied. Please allow microphone access.',
            'not-allowed': 'Microphone access denied. Please allow microphone access.',
            'network': 'Network error. Please check your connection.',
            'service-not-allowed': 'Speech recognition not available in this browser.',
            'bad-grammar': 'Speech recognition error. Please try again.',
            'language-not-supported': `Speech recognition not supported for ${sourceLanguage}. Try switching to English.`
          }
          const errorMsg = errorMessages[event.error] || 'Speech recognition failed. Please try again.'
          toast.error(errorMsg)
          console.error('Speech recognition error:', event.error)
        }
        
        recognition.onend = () => {
          setIsRecording(false)
          recognitionRef.current = null
          
          // Announce recording stopped to screen readers
          ScreenReader.announceRecordingStatus(false, sourceLanguage)
        }
        
        recognition.start()
        
      } else {
        toast.error('Speech recognition not supported in this browser')
      }
      
    } catch (error) {
      console.error('Error starting speech recognition:', error)
      toast.error('Failed to start speech recognition')
    }
  }

  // Removed stopRecording function - now using cancelRecording instead

  // Removed cancelRecording function - now using mic button to stop

    // Removed processAudio function - now using direct speech recognition

  const playAudio = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech synthesis to prevent conflicts
      speechSynthesis.cancel()
      
      const utterance = new SpeechSynthesisUtterance(text)
      const languageMap: Record<string, string> = {
        'es': 'es-ES',
        'pt': 'pt-BR',
        'fa': 'fa-IR',
        'ar': 'ar-SA',
        'zh': 'zh-CN',
        'fr': 'fr-FR',
        'de': 'de-DE'
      }
      utterance.lang = languageMap[currentLanguage] || 'en-US'
      utterance.rate = 0.9
      
      // Add error handling and logging
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event)
      }
      
      utterance.onend = () => {
        console.log('Speech synthesis completed for text:', text.substring(0, 50) + '...')
      }
      
      speechSynthesis.speak(utterance)
      console.log('Playing audio for text:', text.substring(0, 50) + '...', 'Language:', utterance.lang)
    }
  }

  const clearMessages = () => {
    setMessages([])
    setMessageRatings({})
    setShowRatingPrompt(null)
    toast.success('Conversation cleared')
    
    // Log conversation clear for audit trail
    hipaaCompliance.logAuditEntry('conversation_cleared', {
      messageCount: messages.length
    })
  }

  // Handle translation rating
  const handleRating = (messageId: string, rating: number) => {
    setMessageRatings(prev => ({ ...prev, [messageId]: rating }))
    
    // Update message with rating
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { 
            ...msg, 
            rating,
            translationQuality: rating <= 1 ? 'poor' : rating <= 2 ? 'fair' : rating <= 4 ? 'good' : 'excellent'
          }
        : msg
    ))
    
    // Calculate overall translation quality
    const updatedRatings = { ...messageRatings, [messageId]: rating }
    const ratings = Object.values(updatedRatings)
    const averageRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
    const qualityLevel = averageRating <= 1.5 ? 'poor' : averageRating <= 2.5 ? 'fair' : averageRating <= 4 ? 'good' : 'excellent'
    
    setTranslationQuality({
      averageRating: Math.round(averageRating * 10) / 10,
      totalRatings: ratings.length,
      qualityLevel
    })
    
    // Log rating for analytics and quality improvement
    hipaaCompliance.logAuditEntry('translation_rated', { 
      messageId, 
      rating,
      quality: rating <= 1 ? 'poor' : rating <= 2 ? 'fair' : rating <= 4 ? 'good' : 'excellent',
      overallQuality: qualityLevel,
      averageRating
    })
    
    toast.success(`Rating saved: ${rating} stars`)
    setShowRatingPrompt(null)
  }

  // Removed test function - no longer needed

  // Check AI availability
  const checkAiAvailability = useCallback(async () => {
    try {
      // Check if selected provider is a cloud model that supports AI
      const cloudProviders = ['openai', 'google', 'deepl']
      const isCloudProvider = cloudProviders.includes(selectedProvider)
      
      if (!isCloudProvider) {
        setAiStatus('inactive')
        return
      }
      
      // Check if API key exists for the selected provider
      const hasApiKey = selectedApiKey && apiKeys[selectedApiKey] && apiKeys[selectedApiKey].trim() !== ''
      
      if (hasApiKey) {
        setAiStatus('active')
      } else {
        setAiStatus('inactive')
      }
    } catch (error) {
      console.error('Error checking AI availability:', error)
      setAiStatus('inactive')
    }
  }, [apiKeys, selectedProvider, selectedApiKey])

  // Update AI status when API keys or provider changes
  useEffect(() => {
    checkAiAvailability()
  }, [checkAiAvailability])

  // Real-time conversation summary with AI
  const generateConversationSummary = async (messages: Message[]) => {
    try {
      if (!selectedApiKey || !apiKeys[selectedApiKey]) {
        return null
      }

      const conversationText = messages.map(msg => `${msg.isDoctor ? 'Doctor' : 'Patient'}: ${msg.text}`).join('\n')

      // Detect doctor's language based on current role
      // When isDoctor=true: doctor's language is in sourceLanguage (speak in)
      // When isDoctor=false: doctor's language is in currentLanguage (translate to)
      const doctorLanguage = isDoctor ? sourceLanguage.split('-')[0] : currentLanguage
      const languageNames: Record<string, string> = {
        'en': 'English',
        'es': 'Spanish', 
        'pt': 'Portuguese',
        'fa': 'Persian',
        'ar': 'Arabic',
        'zh': 'Chinese',
        'fr': 'French',
        'de': 'German'
      }
      const doctorLanguageName = languageNames[doctorLanguage] || 'English'

      const summaryPrompt = `You are a medical AI assistant. Generate a concise, real-time summary of this medical conversation in ${doctorLanguageName} (doctor's language). Include:

1. **Key Points**: Main topics discussed (max 3 points)
2. **Medical Findings**: Clinical observations and symptoms mentioned (max 3 findings)
3. **Recommendations**: Medical advice or suggestions given (max 3 recommendations)
4. **Urgency Level**: routine/urgent/emergency based on symptoms and context
5. **Next Steps**: Immediate actions needed (max 3 steps)
6. **Confidence**: 0-1 score based on clarity and completeness

IMPORTANT: Always respond in ${doctorLanguageName}, regardless of the conversation language.

Format as JSON:
{
  "keyPoints": ["point1", "point2", "point3"],
  "medicalFindings": ["finding1", "finding2", "finding3"],
  "recommendations": ["rec1", "rec2", "rec3"],
  "urgency": "routine|urgent|emergency",
  "nextSteps": ["step1", "step2", "step3"],
  "confidence": 0.85
}

Conversation:
${conversationText}

Provide a focused, actionable summary for clinical decision-making in ${doctorLanguageName}.`

      // Log AI request for audit
      hipaaCompliance.logAuditEntry('ai_summary_request', { messageCount: messages.length, doctorLanguage }, {
        dataType: 'summary',
        severity: 'medium',
        details: { provider: selectedProvider, model: 'gpt-3.5-turbo' }
      })

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeys[selectedApiKey]}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a medical AI assistant specializing in real-time conversation analysis.' },
            { role: 'user', content: summaryPrompt }
          ],
          temperature: 0.2,
          max_tokens: 800
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('AI summary generation failed:', response.status, errorText)
        
        // Log AI failure for audit
        hipaaCompliance.logAuditEntry('ai_summary_failed', null, {
          dataType: 'summary',
          severity: 'high',
          success: false,
          errorMessage: `HTTP ${response.status}: ${errorText}`
        })
        
        throw new Error(`AI summary generation failed: ${response.status}`)
      }

      const data = await response.json()
      const aiResponse = data.choices[0].message.content.trim()
      
      // Parse AI response
      const summary = JSON.parse(aiResponse)
      
      const result = {
        keyPoints: summary.keyPoints || [],
        medicalFindings: summary.medicalFindings || [],
        recommendations: summary.recommendations || [],
        urgency: summary.urgency || 'routine',
        nextSteps: summary.nextSteps || [],
        confidence: summary.confidence || 0.7,
        lastUpdated: new Date()
      }

      // Log successful AI response for audit
      hipaaCompliance.logAuditEntry('ai_summary_success', result, {
        dataType: 'summary',
        severity: 'low',
        details: { urgency: result.urgency, confidence: result.confidence }
      })
      
      return result
    } catch (error) {
      console.error('AI conversation summary failed:', error)
      
      // Log AI error for audit
      hipaaCompliance.logAuditEntry('ai_summary_error', null, {
        dataType: 'summary',
        severity: 'high',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      })
      
      // Show user-friendly message about fallback
      if (aiStatus === 'active') {
        toast.error('AI summary generation failed, using basic features')
      }
      return null
    }
  }

  // AI-powered medical extraction
    const extractMedicalWithAI = async (messages: Message[]) => {
    try {
      const conversationText = messages.map(msg => `${msg.isDoctor ? 'Doctor' : 'Patient'}: ${msg.text}`).join('\n')

      // Detect doctor's language based on current role
      // When isDoctor=true: doctor's language is in sourceLanguage (speak in)
      // When isDoctor=false: doctor's language is in currentLanguage (translate to)
      const doctorLanguage = isDoctor ? sourceLanguage.split('-')[0] : currentLanguage
      const languageNames: Record<string, string> = {
        'en': 'English',
        'es': 'Spanish', 
        'pt': 'Portuguese',
        'fa': 'Persian',
        'ar': 'Arabic',
        'zh': 'Chinese',
        'fr': 'French',
        'de': 'German'
      }
      const doctorLanguageName = languageNames[doctorLanguage] || 'English'

      const systemPrompt = `You are an intelligent medical AI assistant that analyzes doctor-patient conversations in real-time. Your role is to:

1. **Intelligently categorize medical information** based on content, not conversation stage
2. **Separate patient background** from current situation and ongoing care
3. **Update information dynamically** as new details emerge
4. **Provide context-appropriate summaries** for doctors in ${doctorLanguageName}

**IMPORTANT: Always respond in ${doctorLanguageName}, regardless of the conversation language.**

**Information Categorization Rules:**
- **Patient Background**: Historical information (past conditions, surgeries, family history, chronic medications, allergies, lifestyle habits)
- **Current Situation**: Presenting symptoms, current complaints, recent changes, acute issues
- **Ongoing Care**: Current treatments, medications being taken, recent diagnoses, active monitoring
- **Assessment & Plan**: Doctor's findings, diagnoses, treatment plans, recommendations, follow-up

**Smart Analysis Approach:**
- Analyze the NATURE of information, not when it was mentioned
- Update categories as new information emerges
- Maintain comprehensive tracking across all categories
- Provide real-time insights for clinical decision making in ${doctorLanguageName}`

      const analysisPrompt = `Analyze this medical conversation and provide a comprehensive, intelligently categorized medical summary in ${doctorLanguageName}:

{
  "patientBackground": {
    "currentMedications": ["medications patient is currently taking regularly"],
    "allergies": ["known allergies and reactions"],
    "pastMedicalHistory": ["significant past illnesses, surgeries, chronic conditions"],
    "familyHistory": ["relevant family medical history"],
    "lifestyle": ["smoking, alcohol, exercise, diet, occupation"],
    "chronicConditions": ["ongoing medical conditions"]
  },
  "currentSituation": {
    "chiefComplaint": "primary reason for current visit",
    "presentingSymptoms": ["current symptoms that brought patient in"],
    "acuteIssues": ["new or worsening problems"],
    "recentChanges": ["recent changes in health status"],
    "painLevel": number (1-10 scale, 0 if no pain mentioned),
    "symptomDuration": "how long symptoms have been present"
  },
  "ongoingCare": {
    "activeTreatments": ["current treatments being received"],
    "medications": ["all medications discussed - current and new"],
    "recentDiagnoses": ["diagnoses made in recent visits"],
    "monitoring": ["conditions being monitored"],
    "vitalSigns": {
      "bloodPressure": "if mentioned",
      "temperature": "if mentioned", 
      "heartRate": "if mentioned",
      "weight": "if mentioned",
      "height": "if mentioned"
    }
  },
  "assessmentAndPlan": {
    "diagnosis": ["diagnoses made or suspected"],
    "differentialDiagnosis": ["conditions being considered"],
    "treatmentPlan": ["treatments prescribed or recommended"],
    "medicationsPrescribed": ["new medications prescribed"],
    "recommendations": ["medical recommendations made"],
    "followUp": ["follow-up appointments, tests, monitoring"],
    "patientInstructions": ["instructions given to patient"],
    "severity": "low" | "medium" | "high" | "critical",
    "urgency": "routine" | "urgent" | "emergency"
  },
  "confidence": number (0-1, based on clarity and completeness of information)
}

**Analysis Instructions:**
- Categorize information based on its NATURE, not when it was mentioned
- Patient background can be mentioned at any point in conversation
- Current symptoms can be discussed throughout the visit
- Update all categories as new information emerges
- Maintain comprehensive tracking across the entire conversation
- Focus on clinical relevance and decision-making support
- **IMPORTANT: Always respond in ${doctorLanguageName}, regardless of conversation language**

Conversation:
${conversationText}

Return a comprehensive JSON object with all medical information intelligently categorized in ${doctorLanguageName}.`

      // Log the intelligent analysis approach
      console.log('🤖 AI Medical Extraction - Intelligent Analysis:')
      console.log('💬 Message Count:', messages.length)
      console.log('🎯 System Context:', systemPrompt)
      console.log('📝 Analysis Prompt:', analysisPrompt)
      console.log('💬 Full Conversation:', conversationText)

      // Log the prompt being sent to LLM
      console.log('🤖 AI Medical Extraction - Sending to LLM:')
      console.log('📝 System Prompt:', systemPrompt)
      console.log('📝 Analysis Prompt:', analysisPrompt)
      console.log('💬 Conversation:', conversationText)

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeys[selectedApiKey]}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: analysisPrompt }
          ],
          temperature: 0.1,
          max_tokens: 1500
        })
      })

      if (!response.ok) {
        throw new Error('AI extraction failed')
      }

      const data = await response.json()
      const aiResponse = data.choices[0].message.content.trim()
      
            // Log the raw LLM response
      console.log('🤖 AI Medical Extraction - LLM Response:')
      console.log('📄 Raw Response:', aiResponse)
      console.log('🔍 Parsed JSON:', JSON.parse(aiResponse))

      // Parse AI response
      const extraction = JSON.parse(aiResponse)

      // Process intelligently categorized response
      const processedExtraction: MedicalExtraction = {
        // Legacy fields for backward compatibility
        painLevel: Math.min(Math.max(extraction.currentSituation?.painLevel || extraction.painLevel || 0, 0), 10),
        symptoms: Array.isArray(extraction.currentSituation?.presentingSymptoms) ? extraction.currentSituation.presentingSymptoms : (Array.isArray(extraction.symptoms) ? extraction.symptoms : []),
        medications: Array.isArray(extraction.ongoingCare?.medications) ? extraction.ongoingCare.medications : (Array.isArray(extraction.medications) ? extraction.medications : []),
        medicalHistory: {
          conditions: Array.isArray(extraction.patientBackground?.chronicConditions) ? extraction.patientBackground.chronicConditions : (Array.isArray(extraction.medicalHistory?.conditions) ? extraction.medicalHistory.conditions : []),
          surgeries: Array.isArray(extraction.patientBackground?.pastMedicalHistory) ? extraction.patientBackground.pastMedicalHistory.filter((item: string) => item.toLowerCase().includes('surgery') || item.toLowerCase().includes('operation')) : (Array.isArray(extraction.medicalHistory?.surgeries) ? extraction.medicalHistory.surgeries : []),
          allergies: Array.isArray(extraction.patientBackground?.allergies) ? extraction.patientBackground.allergies : (Array.isArray(extraction.medicalHistory?.allergies) ? extraction.medicalHistory.allergies : []),
          familyHistory: Array.isArray(extraction.patientBackground?.familyHistory) ? extraction.patientBackground.familyHistory : (Array.isArray(extraction.medicalHistory?.familyHistory) ? extraction.medicalHistory.familyHistory : []),
          lifestyle: Array.isArray(extraction.patientBackground?.lifestyle) ? extraction.patientBackground.lifestyle : (Array.isArray(extraction.medicalHistory?.lifestyle) ? extraction.medicalHistory.lifestyle : [])
        },
        vitalSigns: {
          bloodPressure: extraction.ongoingCare?.vitalSigns?.bloodPressure || extraction.vitalSigns?.bloodPressure || undefined,
          temperature: extraction.ongoingCare?.vitalSigns?.temperature || extraction.vitalSigns?.temperature || undefined,
          heartRate: extraction.ongoingCare?.vitalSigns?.heartRate || extraction.vitalSigns?.heartRate || undefined,
          weight: extraction.ongoingCare?.vitalSigns?.weight || extraction.vitalSigns?.weight || undefined,
          height: extraction.ongoingCare?.vitalSigns?.height || extraction.vitalSigns?.height || undefined
        },
        diagnosis: Array.isArray(extraction.assessmentAndPlan?.diagnosis) ? extraction.assessmentAndPlan.diagnosis : (Array.isArray(extraction.diagnosis) ? extraction.diagnosis : []),
        severity: ['low', 'medium', 'high', 'critical'].includes(extraction.assessmentAndPlan?.severity) ? extraction.assessmentAndPlan.severity : (['low', 'medium', 'high', 'critical'].includes(extraction.severity) ? extraction.severity : 'low'),
        recommendations: Array.isArray(extraction.assessmentAndPlan?.recommendations) ? extraction.assessmentAndPlan.recommendations : (Array.isArray(extraction.recommendations) ? extraction.recommendations : []),
        urgency: ['routine', 'urgent', 'emergency'].includes(extraction.assessmentAndPlan?.urgency) ? extraction.assessmentAndPlan.urgency : (['routine', 'urgent', 'emergency'].includes(extraction.urgency) ? extraction.urgency : 'routine'),
        confidence: Math.min(Math.max(extraction.confidence || 0.5, 0), 1),

        // New AI-powered intelligent categorization
        patientBackground: {
          currentMedications: Array.isArray(extraction.patientBackground?.currentMedications) ? extraction.patientBackground.currentMedications : [],
          allergies: Array.isArray(extraction.patientBackground?.allergies) ? extraction.patientBackground.allergies : [],
          pastMedicalHistory: Array.isArray(extraction.patientBackground?.pastMedicalHistory) ? extraction.patientBackground.pastMedicalHistory : [],
          familyHistory: Array.isArray(extraction.patientBackground?.familyHistory) ? extraction.patientBackground.familyHistory : [],
          lifestyle: Array.isArray(extraction.patientBackground?.lifestyle) ? extraction.patientBackground.lifestyle : [],
          chronicConditions: Array.isArray(extraction.patientBackground?.chronicConditions) ? extraction.patientBackground.chronicConditions : []
        },
        currentSituation: {
          chiefComplaint: extraction.currentSituation?.chiefComplaint || '',
          presentingSymptoms: Array.isArray(extraction.currentSituation?.presentingSymptoms) ? extraction.currentSituation.presentingSymptoms : [],
          acuteIssues: Array.isArray(extraction.currentSituation?.acuteIssues) ? extraction.currentSituation.acuteIssues : [],
          recentChanges: Array.isArray(extraction.currentSituation?.recentChanges) ? extraction.currentSituation.recentChanges : [],
          painLevel: Math.min(Math.max(extraction.currentSituation?.painLevel || 0, 0), 10),
          symptomDuration: extraction.currentSituation?.symptomDuration || ''
        },
        ongoingCare: {
          activeTreatments: Array.isArray(extraction.ongoingCare?.activeTreatments) ? extraction.ongoingCare.activeTreatments : [],
          medications: Array.isArray(extraction.ongoingCare?.medications) ? extraction.ongoingCare.medications : [],
          recentDiagnoses: Array.isArray(extraction.ongoingCare?.recentDiagnoses) ? extraction.ongoingCare.recentDiagnoses : [],
          monitoring: Array.isArray(extraction.ongoingCare?.monitoring) ? extraction.ongoingCare.monitoring : [],
          vitalSigns: {
            bloodPressure: extraction.ongoingCare?.vitalSigns?.bloodPressure || undefined,
            temperature: extraction.ongoingCare?.vitalSigns?.temperature || undefined,
            heartRate: extraction.ongoingCare?.vitalSigns?.heartRate || undefined,
            weight: extraction.ongoingCare?.vitalSigns?.weight || undefined,
            height: extraction.ongoingCare?.vitalSigns?.height || undefined
          }
        },
        assessmentAndPlan: {
          diagnosis: Array.isArray(extraction.assessmentAndPlan?.diagnosis) ? extraction.assessmentAndPlan.diagnosis : [],
          differentialDiagnosis: Array.isArray(extraction.assessmentAndPlan?.differentialDiagnosis) ? extraction.assessmentAndPlan.differentialDiagnosis : [],
          treatmentPlan: Array.isArray(extraction.assessmentAndPlan?.treatmentPlan) ? extraction.assessmentAndPlan.treatmentPlan : [],
          medicationsPrescribed: Array.isArray(extraction.assessmentAndPlan?.medicationsPrescribed) ? extraction.assessmentAndPlan.medicationsPrescribed : [],
          recommendations: Array.isArray(extraction.assessmentAndPlan?.recommendations) ? extraction.assessmentAndPlan.recommendations : [],
          followUp: Array.isArray(extraction.assessmentAndPlan?.followUp) ? extraction.assessmentAndPlan.followUp : [],
          patientInstructions: Array.isArray(extraction.assessmentAndPlan?.patientInstructions) ? extraction.assessmentAndPlan.patientInstructions : [],
          severity: ['low', 'medium', 'high', 'critical'].includes(extraction.assessmentAndPlan?.severity) ? extraction.assessmentAndPlan.severity : 'low',
          urgency: ['routine', 'urgent', 'emergency'].includes(extraction.assessmentAndPlan?.urgency) ? extraction.assessmentAndPlan.urgency : 'routine'
        }
      }
      
      // Log the final processed extraction
      console.log('🤖 AI Medical Extraction - Final Result:')
      console.log('✅ Processed Extraction:', processedExtraction)
      
      return processedExtraction
    } catch (error) {
      console.error('AI extraction failed, falling back to pattern-based extraction:', error)
      // Show user-friendly message about fallback
      if (aiStatus === 'active') {
        toast.error('AI medical analysis failed, using basic pattern detection')
      }
      return MedicalExtractionService.extractFromConversation(messages)
    }
  }

  // Update medical extraction and conversation summary when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const extractMedical = async () => {
        let extraction
        
        if (aiStatus === 'active') {
          extraction = await extractMedicalWithAI(messages)
        } else {
          extraction = MedicalExtractionService.extractFromConversation(messages)
        }
        
        setMedicalExtraction(extraction)
        
        // Log medical extraction for audit trail
        if (extraction.confidence > 0.3) {
          hipaaCompliance.logAuditEntry('medical_extraction', {
            method: aiStatus === 'active' ? 'ai' : 'pattern',
            confidence: extraction.confidence,
            painLevel: extraction.painLevel,
            symptomsCount: extraction.symptoms.length,
            medicationsCount: extraction.medications.length,
            severity: extraction.severity
          })
        }
      }
      
      const generateSummary = async () => {
        // Generate conversation summary every 3 messages or when conversation is substantial
        if (messages.length % 3 === 0 || messages.length >= 5) {
          const summary = await generateConversationSummary(messages)
          if (summary) {
            setConversationSummary(summary)
          }
        }
      }
      
      extractMedical()
      generateSummary()
    }
  }, [messages, aiStatus, apiKeys.openai])

  // Rating component
  const RatingStars = ({ messageId, currentRating, onRate }: { 
    messageId: string
    currentRating?: number
    onRate: (rating: number) => void 
  }) => {
    return (
      <div className="flex items-center space-x-1 mt-2">
        <span className="text-xs text-white/60 mr-2">Rate translation:</span>
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            onClick={() => onRate(star)}
            className={`text-sm transition-colors p-1 rounded ${
              currentRating && star <= currentRating 
                ? 'text-yellow-400 bg-yellow-400/10' 
                : 'text-white/30 hover:text-yellow-300 hover:bg-white/10'
            }`}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            aria-label={`Rate ${star} stars`}
          >
            <Star className="w-4 h-4 sm:w-5 sm:h-5" fill={currentRating && star <= currentRating ? 'currentColor' : 'none'} />
          </motion.button>
        ))}
      </div>
    )
  }

  // Medical Summary Component
  const MedicalSummary = ({ extraction }: { extraction: MedicalExtraction }) => {
    return (
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Medical Summary</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              extraction.severity === 'high' ? 'bg-red-400' :
              extraction.severity === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
            }`}></div>
            <span className="text-xs text-white/60 capitalize">{extraction.severity} severity</span>
            <div className="flex items-center space-x-1 ml-2">
              <div className={`w-2 h-2 rounded-full ${
                aiStatus === 'active' ? 'bg-green-400' : 'bg-gray-400'
              }`}></div>
              <span className="text-xs text-white/60">
                {aiStatus === 'active' ? 'AI' : 'Pattern'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Pain Level */}
        {extraction.painLevel > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">Pain Level</h4>
            <div className="flex items-center space-x-3">
              <div className="flex-1 bg-white/10 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    extraction.painLevel <= 3 ? 'bg-green-400' :
                    extraction.painLevel <= 6 ? 'bg-yellow-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${(extraction.painLevel / 10) * 100}%` }}
                ></div>
              </div>
              <span className="text-sm text-white font-medium">{extraction.painLevel}/10</span>
            </div>
          </div>
        )}
        
        {/* Symptoms */}
        {extraction.symptoms.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">Symptoms</h4>
            <div className="flex flex-wrap gap-2">
              {extraction.symptoms.map((symptom, index) => (
                <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-200 text-xs rounded-full border border-blue-400/30">
                  {symptom}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Medications */}
        {extraction.medications.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">Medications</h4>
            <div className="flex flex-wrap gap-2">
              {extraction.medications.map((medication, index) => (
                <span key={index} className="px-2 py-1 bg-purple-500/20 text-purple-200 text-xs rounded-full border border-purple-400/30">
                  {medication}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Medical History */}
        {(extraction.medicalHistory.conditions.length > 0 || 
          extraction.medicalHistory.surgeries.length > 0 || 
          extraction.medicalHistory.allergies.length > 0 || 
          extraction.medicalHistory.familyHistory.length > 0 || 
          extraction.medicalHistory.lifestyle.length > 0) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">Medical History</h4>
            <div className="space-y-2 text-xs">
              {extraction.medicalHistory.conditions.length > 0 && (
                <div>
                  <span className="text-white/60">Conditions:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {extraction.medicalHistory.conditions.map((condition, index) => (
                      <span key={index} className="px-2 py-1 bg-red-500/20 text-red-200 rounded-full border border-red-400/30">
                        {condition}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {extraction.medicalHistory.surgeries.length > 0 && (
                <div>
                  <span className="text-white/60">Surgeries:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {extraction.medicalHistory.surgeries.map((surgery, index) => (
                      <span key={index} className="px-2 py-1 bg-orange-500/20 text-orange-200 rounded-full border border-orange-400/30">
                        {surgery}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {extraction.medicalHistory.allergies.length > 0 && (
                <div>
                  <span className="text-white/60">Allergies:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {extraction.medicalHistory.allergies.map((allergy, index) => (
                      <span key={index} className="px-2 py-1 bg-yellow-500/20 text-yellow-200 rounded-full border border-yellow-400/30">
                        {allergy}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {extraction.medicalHistory.familyHistory.length > 0 && (
                <div>
                  <span className="text-white/60">Family History:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {extraction.medicalHistory.familyHistory.map((history, index) => (
                      <span key={index} className="px-2 py-1 bg-purple-500/20 text-purple-200 rounded-full border border-purple-400/30">
                        {history}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {extraction.medicalHistory.lifestyle.length > 0 && (
                <div>
                  <span className="text-white/60">Lifestyle:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {extraction.medicalHistory.lifestyle.map((lifestyle, index) => (
                      <span key={index} className="px-2 py-1 bg-cyan-500/20 text-cyan-200 rounded-full border border-cyan-400/30">
                        {lifestyle}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Vital Signs */}
        {Object.values(extraction.vitalSigns).some(value => value) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">Vital Signs</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {extraction.vitalSigns.bloodPressure && (
                <div className="flex justify-between">
                  <span className="text-white/60">BP:</span>
                  <span className="text-white">{extraction.vitalSigns.bloodPressure}</span>
                </div>
              )}
              {extraction.vitalSigns.temperature && (
                <div className="flex justify-between">
                  <span className="text-white/60">Temp:</span>
                  <span className="text-white">{extraction.vitalSigns.temperature}</span>
                </div>
              )}
              {extraction.vitalSigns.heartRate && (
                <div className="flex justify-between">
                  <span className="text-white/60">HR:</span>
                  <span className="text-white">{extraction.vitalSigns.heartRate}</span>
                </div>
              )}
              {extraction.vitalSigns.weight && (
                <div className="flex justify-between">
                  <span className="text-white/60">Weight:</span>
                  <span className="text-white">{extraction.vitalSigns.weight}</span>
                </div>
              )}
              {extraction.vitalSigns.height && (
                <div className="flex justify-between">
                  <span className="text-white/60">Height:</span>
                  <span className="text-white">{extraction.vitalSigns.height}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Diagnosis */}
        {extraction.diagnosis.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">Diagnosis</h4>
            <div className="flex flex-wrap gap-2">
              {extraction.diagnosis.map((diagnosis, index) => (
                <span key={index} className="px-2 py-1 bg-red-500/20 text-red-200 text-xs rounded-full border border-red-400/30">
                  {diagnosis}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Urgency */}
        {extraction.urgency && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">Urgency</h4>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                extraction.urgency === 'emergency' ? 'bg-red-400' :
                extraction.urgency === 'urgent' ? 'bg-orange-400' : 'bg-green-400'
              }`}></div>
              <span className="text-xs text-white capitalize">{extraction.urgency}</span>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {extraction.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">Recommendations</h4>
            <ul className="space-y-1">
              {extraction.recommendations.map((rec, index) => (
                <li key={index} className="text-xs text-white/80 flex items-start space-x-2">
                  <span className="text-yellow-400 mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Confidence Level */}
        <div className="flex items-center justify-between pt-2 border-t border-white/20">
          <span className="text-xs text-white/60">Extraction Confidence</span>
          <div className="flex items-center space-x-2">
            <div className="w-16 bg-white/10 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  extraction.confidence >= 0.7 ? 'bg-green-400' :
                  extraction.confidence >= 0.4 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${extraction.confidence * 100}%` }}
              ></div>
            </div>
            <span className="text-xs text-white font-medium">{Math.round(extraction.confidence * 100)}%</span>
          </div>
        </div>
      </div>
    )
  }

  // Check if provider is cloud-based
  const isCloudProvider = (providerId: string) => {
    return ['openai', 'google', 'deepl'].includes(providerId)
  }

  // Get API key names for current provider
  const getApiKeyNamesForProvider = (providerId: string) => {
    // Filter API key names that start with the provider ID
    return Object.keys(apiKeys).filter(keyName => keyName.startsWith(`${providerId}_`))
  }

  // Handle provider change with API key reset
  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider)
    
    // Get available API keys for the new provider
    const availableKeys = getApiKeyNamesForProvider(provider)
    
    // If there are available keys, select the first one
    if (availableKeys.length > 0) {
      setSelectedApiKey(availableKeys[0])
    } else {
      setSelectedApiKey('') // Reset if no keys available
    }
  }


  // Save API key to secure storage
  const saveApiKeyToStorage = async (name: string, key: string) => {
    try {
      // Create a provider-aware key name
      const providerKeyName = `${selectedProvider}_${name}`
      console.log('🔑 Saving API key:', { provider: selectedProvider, name, providerKeyName })
      
      const result = await secureStorage.storeApiKey(providerKeyName, key)
      if (result.success) {
        setApiKeys(prev => ({ ...prev, [providerKeyName]: key }))
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
  }

  // Delete API key
  const deleteApiKey = async (name: string) => {
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
  }

  // Edit API key
  const editApiKey = (name: string) => {
    setNewApiKeyName(name)
    setNewApiKey(apiKeys[name] || '')
    setShowApiKeyInput(true)
  }

  // Handle save case
  const handleSaveCase = async () => {
    if (saveMode === 'new' && !newFileName.trim()) {
      toast.error('Please enter a file name')
      return
    }
    
    if (saveMode === 'existing' && !selectedFileToOverwrite) {
      toast.error('Please select a file to overwrite')
      return
    }
    
    try {
      const fileName = saveMode === 'new' ? newFileName : selectedFileToOverwrite
      await saveCurrentCase(fileName, saveMode === 'existing' ? selectedFileToOverwrite : undefined)
      setShowSaveDialog(false)
      setNewFileName('')
      setSaveMode('new')
      setSelectedFileToOverwrite('')
      toast.success('Case saved successfully')
    } catch (error) {
      console.error('Error saving case:', error)
      toast.error('Failed to save case')
    }
  }

  // Handle load case
  const handleLoadCase = async () => {
    if (!selectedFileToLoad) {
      toast.error('Please select a file to load')
      return
    }
    
    try {
      await loadCase(selectedFileToLoad)
      setShowLoadDialog(false)
      setSelectedFileToLoad('')
      toast.success('Case loaded successfully')
    } catch (error) {
      console.error('Error loading case:', error)
      toast.error('Failed to load case')
    }
  }

  // Handle delete case
  const handleDeleteCase = async () => {
    if (!selectedFileToDelete) {
      toast.error('Please select a file to delete')
      return
    }
    
    if (!window.confirm(`Are you sure you want to delete "${selectedFileToDelete}"?`)) {
      return
    }
    
    try {
      deleteCase(selectedFileToDelete)
      setShowDeleteDialog(false)
      setSelectedFileToDelete('')
      toast.success('Case deleted successfully')
    } catch (error) {
      console.error('Error deleting case:', error)
      toast.error('Failed to delete case')
    }
  }



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Skip link for keyboard users */}
      {createSkipLink('main-content', 'Skip to main content')}
      
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"></div>

      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#1f2937',
          },
        }}
      />
      
      {/* Header Component */}
      <Header
        aiStatus={aiStatus}
        aiMode={aiMode}
        activeModel={activeModel}
        showSettings={showSettings}
        showHamburgerMenu={showHamburgerMenu}
        setShowSettings={setShowSettings}
        setShowHamburgerMenu={setShowHamburgerMenu}
        toggleAiMode={toggleAiMode}
        refreshSavedCases={refreshSavedCases}
        setShowSaveDialog={setShowSaveDialog}
        setShowLoadDialog={setShowLoadDialog}
        setShowDeleteDialog={setShowDeleteDialog}
        clearConversation={clearConversation}
      />
      

      <div className="relative z-10 max-w-4xl mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          
          {/* Main Translation Interface - Centered */}
          <div className="lg:col-span-2" id="main-content">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-4 sm:p-8 shadow-2xl"
            >
              {/* Role Switcher Component */}
              <RoleSwitcher
                isDoctor={isDoctor}
                switchRole={switchRole}
              />

              {/* Recording Controls Component */}
              <RecordingControls
                isRecording={isRecording}
                showManualInput={showManualInput}
                setShowManualInput={setShowManualInput}
                startRecording={startRecording}
                clearMessages={clearMessages}
                medicalExtraction={medicalExtraction}
                conversationSummary={conversationSummary}
                setShowMedicalSummaryModal={setShowMedicalSummaryModal}
                setShowConversationSummaryModal={setShowConversationSummaryModal}
              />

              {/* Language Selector Component */}
              <LanguageSelector
                sourceLanguage={sourceLanguage}
                currentLanguage={currentLanguage}
                setSourceLanguage={setSourceLanguage}
                setCurrentLanguage={setCurrentLanguage}
              />

              {/* Manual Text Input Component */}
              <ManualTextInput
                showManualInput={showManualInput}
                manualText={manualText}
                setManualText={setManualText}
                handleManualTranslation={handleManualTranslation}
              />

              {/* Status Indicator Component */}
              <StatusIndicator
                isRecording={isRecording}
                sourceLanguage={sourceLanguage}
                currentLanguage={currentLanguage}
              />
            </motion.div>
          </div>


        </div>

       {/* Conversation Display Component */}
       <ConversationDisplay
          messages={messages}
          playAudio={playAudio}
          handleRating={handleRating}
        />

       {/* Live Medical Summary */}
       {medicalExtraction && medicalExtraction.confidence > 0.3 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center space-x-3 mb-6">
               <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
               <h3 className="text-xl font-semibold text-white">Live Medical Summary</h3>
               <div className="flex items-center space-x-2 ml-auto">
                 <div className={`w-3 h-3 rounded-full ${
                   medicalExtraction.severity === 'high' ? 'bg-red-400' :
                   medicalExtraction.severity === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                        }`}></div>
                 <span className="text-xs text-white/60 capitalize">{medicalExtraction.severity} severity</span>
                  <div className="flex items-center space-x-1 ml-2">
                    <div className={`w-2 h-2 rounded-full ${
                      aiStatus === 'active' ? 'bg-green-400' : 'bg-gray-400'
                    }`}></div>
                    <span className="text-xs text-white/60">
                      {aiStatus === 'active' ? 'AI' : 'Pattern'}
                    </span>
                  </div>
                </div>
                          </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               {/* Pain Level */}
               {medicalExtraction.painLevel > 0 && (
                 <div className="space-y-2">
                   <h4 className="text-sm font-medium text-white">Pain Level</h4>
                   <div className="flex items-center space-x-3">
                            <div className="flex-1 bg-white/10 rounded-full h-2">
                              <div 
                         className={`h-2 rounded-full transition-all duration-300 ${
                           medicalExtraction.painLevel <= 3 ? 'bg-green-400' :
                           medicalExtraction.painLevel <= 6 ? 'bg-yellow-400' : 'bg-red-400'
                         }`}
                         style={{ width: `${(medicalExtraction.painLevel / 10) * 100}%` }}
                              ></div>
                            </div>
                     <span className="text-sm text-white font-medium">{medicalExtraction.painLevel}/10</span>
                    </div>
                  </div>
                )}

               {/* Symptoms */}
               {medicalExtraction.symptoms.length > 0 && (
                 <div className="space-y-2">
                   <h4 className="text-sm font-medium text-white">Symptoms</h4>
                   <div className="flex flex-wrap gap-2">
                     {medicalExtraction.symptoms.slice(0, 5).map((symptom, index) => (
                       <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-200 text-xs rounded-full border border-blue-400/30">
                         {symptom}
                              </span>
                            ))}
                     {medicalExtraction.symptoms.length > 5 && (
                       <span className="px-2 py-1 bg-blue-500/20 text-blue-200 text-xs rounded-full border border-blue-400/30">
                         +{medicalExtraction.symptoms.length - 5} more
                              </span>
                      )}
                    </div>
                  </div>
                )}

               {/* Medications */}
               {medicalExtraction.medications.length > 0 && (
                 <div className="space-y-2">
                   <h4 className="text-sm font-medium text-white">Medications</h4>
                   <div className="flex flex-wrap gap-2">
                     {medicalExtraction.medications.slice(0, 3).map((medication, index) => (
                       <span key={index} className="px-2 py-1 bg-purple-500/20 text-purple-200 text-xs rounded-full border border-purple-400/30">
                         {medication}
                              </span>
                            ))}
                     {medicalExtraction.medications.length > 3 && (
                       <span className="px-2 py-1 bg-purple-500/20 text-purple-200 text-xs rounded-full border border-purple-400/30">
                         +{medicalExtraction.medications.length - 3} more
                              </span>
                     )}
                          </div>
                        </div>
                      )}
               
               {/* Recommendations */}
               {medicalExtraction.recommendations.length > 0 && (
                 <div className="space-y-2">
                   <h4 className="text-sm font-medium text-white">Recommendations</h4>
                   <div className="space-y-1">
                     {medicalExtraction.recommendations.slice(0, 3).map((rec, index) => (
                       <div key={index} className="text-xs text-white/80 flex items-start space-x-2">
                         <span className="text-yellow-400 mt-1">•</span>
                                <span>{rec}</span>
                        </div>
                     ))}
                        </div>
                        </div>
                      )}
                            </div>
             
             {/* Confidence Level */}
             <div className="flex items-center justify-between pt-4 border-t border-white/20 mt-6">
               <span className="text-xs text-white/60">Extraction Confidence</span>
                            <div className="flex items-center space-x-2">
                 <div className="w-16 bg-white/10 rounded-full h-2">
                   <div 
                     className={`h-2 rounded-full transition-all duration-300 ${
                       medicalExtraction.confidence >= 0.7 ? 'bg-green-400' :
                       medicalExtraction.confidence >= 0.4 ? 'bg-yellow-400' : 'bg-red-400'
                     }`}
                     style={{ width: `${medicalExtraction.confidence * 100}%` }}
                   ></div>
                            </div>
                 <span className="text-xs text-white font-medium">{Math.round(medicalExtraction.confidence * 100)}%</span>
                        </div>
                    </div>
                  </div>
              </motion.div>
            )}
      </div>

      {/* Settings Panel Component */}
      <SettingsPanel
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        selectedProvider={selectedProvider}
        setSelectedProvider={handleProviderChange}
        providers={providers}
        apiKeys={apiKeys}
        apiKeyNames={apiKeyNames}
        selectedApiKey={selectedApiKey}
        setSelectedApiKey={setSelectedApiKey}
        newApiKey={newApiKey}
        setNewApiKey={setNewApiKey}
        newApiKeyName={newApiKeyName}
        setNewApiKeyName={setNewApiKeyName}
        showApiKeyInput={showApiKeyInput}
        setShowApiKeyInput={setShowApiKeyInput}
        showApiKeyDropdown={showApiKeyDropdown}
        setShowApiKeyDropdown={setShowApiKeyDropdown}
        saveApiKeyToStorage={saveApiKeyToStorage}
        deleteApiKey={removeApiKey}
        editApiKey={editApiKey}
        isCloudProvider={isCloudProvider}
        getApiKeyNamesForProvider={getApiKeyNamesForProvider}
        hipaaCompliance={hipaaCompliance}
      />

      {/* Modal Components */}
      <SaveDialog
        showSaveDialog={showSaveDialog}
        setShowSaveDialog={setShowSaveDialog}
        saveMode={saveMode}
        setSaveMode={setSaveMode}
        newFileName={newFileName}
        setNewFileName={setNewFileName}
        selectedFileToOverwrite={selectedFileToOverwrite}
        setSelectedFileToOverwrite={setSelectedFileToOverwrite}
        savedCases={savedCases}
        onSave={handleSaveCase}
      />

      <LoadDialog
        showLoadDialog={showLoadDialog}
        setShowLoadDialog={setShowLoadDialog}
        selectedFileToLoad={selectedFileToLoad}
        setSelectedFileToLoad={setSelectedFileToLoad}
        savedCases={savedCases}
        onLoad={handleLoadCase}
      />

      <DeleteDialog
        showDeleteDialog={showDeleteDialog}
        setShowDeleteDialog={setShowDeleteDialog}
        selectedFileToDelete={selectedFileToDelete}
        setSelectedFileToDelete={setSelectedFileToDelete}
        savedCases={savedCases}
        onDelete={handleDeleteCase}
      />

      <MedicalSummaryModal
        showMedicalSummaryModal={showMedicalSummaryModal}
        setShowMedicalSummaryModal={setShowMedicalSummaryModal}
        medicalExtraction={medicalExtraction}
        aiStatus={aiStatus}
      />

      {showConversationSummaryModal && (
        <ConversationSummaryModal
          summary={conversationSummary}
          onClose={() => setShowConversationSummaryModal(false)}
        />
      )}
    </div>
  )
}

export default App
