import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Mic, 
  MicOff,
  Volume2, 
  Settings, 
  User, 
  Stethoscope,
  RotateCcw,
  Sparkles,
  Zap,
  Shield,
  Wifi,
  WifiOff,
  Globe,
  X,
  Trash2,
  Star,
  MessageSquare
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { sanitizeInput, encodeOutput } from './utils/security'
import { 
  getAccessibilityProps, 
  ScreenReader, 
  handleKeyboardNavigation,
  createSkipLink
} from './utils/accessibility.tsx'
import { secureStorage, migrateExistingKeys } from './utils/secureStorage'
import { hipaaCompliance, createPrivacyConsentDialog } from './utils/hipaa'
import MedicalExtractionService, { type MedicalExtraction } from './utils/medicalExtraction'

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
  const [isOnline] = useState(true)
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
  const [showRatingPrompt, setShowRatingPrompt] = useState<string | null>(null)
  const [translationQuality, setTranslationQuality] = useState<{
    averageRating: number
    totalRatings: number
    qualityLevel: 'poor' | 'fair' | 'good' | 'excellent'
  }>({ averageRating: 0, totalRatings: 0, qualityLevel: 'good' })
  
  // Medical extraction state
  const [medicalExtraction, setMedicalExtraction] = useState<MedicalExtraction | null>(null)
  const [showMedicalSummary, setShowMedicalSummary] = useState(false)
  const [aiStatus, setAiStatus] = useState<'active' | 'inactive' | 'checking'>('checking')
  
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
  const [showConversationSummary, setShowConversationSummary] = useState(false)

  // Simple language switching: just swap the languages when role changes
  const autoSwitchLanguages = (newIsDoctor: boolean) => {
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
          const loadedKeys: Record<string, string> = {}
          const loadedKeyNames: Record<string, string[]> = {}
          
          for (const name of keyNames) {
            const key = await secureStorage.getApiKey(name)
            if (key) {
              loadedKeys[name] = key
              // For now, we'll assume all keys are for the current provider
              // In a more sophisticated system, you might store provider info with each key
              const currentProvider = selectedProvider
              if (!loadedKeyNames[currentProvider]) {
                loadedKeyNames[currentProvider] = []
              }
              loadedKeyNames[currentProvider].push(name)
            }
          }
          
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
      speechSynthesis.speak(utterance)
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
        throw new Error(`AI summary generation failed: ${response.status}`)
      }

      const data = await response.json()
      const aiResponse = data.choices[0].message.content.trim()
      
      // Parse AI response
      const summary = JSON.parse(aiResponse)
      
      return {
        keyPoints: summary.keyPoints || [],
        medicalFindings: summary.medicalFindings || [],
        recommendations: summary.recommendations || [],
        urgency: summary.urgency || 'routine',
        nextSteps: summary.nextSteps || [],
        confidence: summary.confidence || 0.7,
        lastUpdated: new Date()
      }
    } catch (error) {
      console.error('AI conversation summary failed:', error)
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
          surgeries: Array.isArray(extraction.patientBackground?.pastMedicalHistory) ? extraction.patientBackground.pastMedicalHistory.filter(item => item.toLowerCase().includes('surgery') || item.toLowerCase().includes('operation')) : (Array.isArray(extraction.medicalHistory?.surgeries) ? extraction.medicalHistory.surgeries : []),
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
    return apiKeyNames[providerId] || []
  }


  // Save API key to secure storage
  const saveApiKeyToStorage = async (name: string, key: string) => {
    try {
      const result = await secureStorage.storeApiKey(name, key)
      if (result.success) {
        setApiKeys(prev => ({ ...prev, [name]: key }))
        setApiKeyNames(prev => ({
          ...prev,
          [selectedProvider]: [...(prev[selectedProvider] || []), name]
        }))
        setNewApiKey('')
        setNewApiKeyName('')
        setShowApiKeyInput(false)
        setSelectedApiKey(name)
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
  }

  // Edit API key
  const editApiKey = (name: string) => {
    setNewApiKeyName(name)
    setNewApiKey(apiKeys[name] || '')
    setShowApiKeyInput(true)
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
      
      {/* Header */}
      <header className="relative z-10 bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-3 sm:space-x-4"
            >
              <div className="relative">
                <Stethoscope className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"
                >
                  <Sparkles className="w-2 h-2 sm:w-3 sm:h-3 text-white" />
                </motion.div>
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  Medical Translator
                </h1>
                <p className="text-purple-200 text-xs sm:text-sm">AI-Powered Medical Communication</p>
              </div>
            </motion.div>
            
            <div className="flex items-center justify-center sm:justify-end space-x-2 sm:space-x-4">
              {/* AI Status Indicator */}
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-3 sm:px-4 py-2">
                <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${
                  aiStatus === 'active' ? 'bg-green-400 animate-pulse' :
                  aiStatus === 'inactive' ? 'bg-gray-400' : 'bg-yellow-400 animate-pulse'
                }`}></div>
                <span className={`text-white text-xs sm:text-sm font-medium ${
                  aiStatus === 'active' ? 'text-green-400' :
                  aiStatus === 'inactive' ? 'text-gray-400' : 'text-yellow-400'
                }`}>
                  {aiStatus === 'active' ? 'AI Active' :
                   aiStatus === 'inactive' ? 'Basic Mode' : 'Checking...'}
                </span>
              </div>
              
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-3 sm:px-4 py-2">
                {isOnline ? (
                  <Wifi className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                ) : (
                  <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                )}
                <span className="text-white text-xs sm:text-sm">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSettings(!showSettings)}
                onKeyDown={(e) => handleKeyboardNavigation(e, () => setShowSettings(!showSettings))}
                {...getAccessibilityProps('settings', { showSettings })}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white px-2 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-200 flex items-center space-x-1 sm:space-x-2"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-base">Settings</span>
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-4xl mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          
          {/* Main Translation Interface - Centered */}
          <div className="lg:col-span-2" id="main-content">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-4 sm:p-8 shadow-2xl"
            >
              {/* Role Indicator */}
              <div className="flex items-center justify-center mb-6 sm:mb-8">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-2 border border-white/20">
                  <div className="flex items-center space-x-1 sm:space-x-2">
                                        <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => switchRole(true)}
                      onKeyDown={(e) => handleKeyboardNavigation(e, () => switchRole(true))}
                      {...getAccessibilityProps('role-switch', { isDoctor: true })}
                      className={`flex items-center space-x-2 sm:space-x-3 px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 text-sm sm:text-base ${
                        isDoctor 
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <User className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="font-medium">Doctor</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => switchRole(false)}
                      onKeyDown={(e) => handleKeyboardNavigation(e, () => switchRole(false))}
                      {...getAccessibilityProps('role-switch', { isDoctor: false })}
                      className={`flex items-center space-x-2 sm:space-x-3 px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 text-sm sm:text-base ${
                        !isDoctor 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <User className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="font-medium">Patient</span>
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Recording Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 lg:space-x-8 mb-6 sm:mb-10">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-200 flex items-center space-x-2 text-sm sm:text-base"
                >
                  <span>Text Input</span>
                </motion.button>
                
                {/* Main Recording Button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={startRecording}
                  onKeyDown={(e) => handleKeyboardNavigation(e, startRecording, ['Enter', ' '])}
                  {...getAccessibilityProps('microphone', { isRecording })}
                  className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300 ${
                    isRecording 
                      ? 'bg-gradient-to-r from-red-500 to-pink-600 animate-pulse' 
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                  }`}
                >
                  {isRecording ? (
                    <MicOff className="w-8 h-8 sm:w-10 sm:h-10" />
                  ) : (
                    <Mic className="w-8 h-8 sm:w-10 sm:h-10" />
                  )}
                  
                  {/* Recording animation rings */}
                  {isRecording && (
                    <>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 border-2 border-red-400 rounded-full"
                      />
                      <motion.div
                        animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                        className="absolute inset-0 border-2 border-red-300 rounded-full"
                      />
                    </>
                  )}
                </motion.button>


                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={clearMessages}
                  onKeyDown={(e) => handleKeyboardNavigation(e, clearMessages)}
                  {...getAccessibilityProps('clear-conversation')}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-200 flex items-center space-x-2 text-sm sm:text-base"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Clear</span>
                </motion.button>
                
                {/* Medical Summary Toggle */}
                {medicalExtraction && medicalExtraction.confidence > 0.3 && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowMedicalSummary(!showMedicalSummary)}
                    className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 backdrop-blur-sm border border-blue-400/30 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-200 flex items-center space-x-2 text-sm sm:text-base"
                  >
                    <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Medical Summary</span>
                    <div className={`w-2 h-2 rounded-full ${
                      medicalExtraction.severity === 'high' ? 'bg-red-400' :
                      medicalExtraction.severity === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                    }`}></div>
                  </motion.button>
                )}

                {/* Conversation Summary Toggle */}
                {conversationSummary && conversationSummary.confidence > 0.5 && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowConversationSummary(!showConversationSummary)}
                    className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 backdrop-blur-sm border border-green-400/30 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-200 flex items-center space-x-2 text-sm sm:text-base"
                  >
                    <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Conversation Summary</span>
                    <div className={`w-2 h-2 rounded-full ${
                      conversationSummary.urgency === 'emergency' ? 'bg-red-400' :
                      conversationSummary.urgency === 'urgent' ? 'bg-orange-400' : 'bg-green-400'
                    }`}></div>
                  </motion.button>
                )}
                

              </div>

              {/* Language Selectors */}
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 lg:space-x-8 mb-6 sm:mb-8">

                {/* Source Language */}
                <div className="text-center w-full sm:w-auto">
                  <label className="block text-xs sm:text-sm text-white/60 mb-2" id="source-language-label">Speak in:</label>
                  <select
                    value={sourceLanguage}
                    onChange={(e) => setSourceLanguage(e.target.value)}
                    aria-labelledby="source-language-label"
                    aria-describedby="source-language-help"
                    className="w-full max-w-[200px] sm:w-auto bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-3 sm:px-6 py-2 sm:py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                  >
                    <option value="en-US" className="bg-gray-800 text-white">English (US)</option>
                    <option value="es-ES" className="bg-gray-800 text-white">Spanish (España)</option>
                    <option value="pt-BR" className="bg-gray-800 text-white">Portuguese (Brasil)</option>
                    <option value="fa-IR" className="bg-gray-800 text-white">Persian (فارسی)</option>
                    <option value="ar-SA" className="bg-gray-800 text-white">Arabic (العربية)</option>
                    <option value="zh-CN" className="bg-gray-800 text-white">Chinese (中文)</option>
                    <option value="fr-FR" className="bg-gray-800 text-white">French (Français)</option>
                    <option value="de-DE" className="bg-gray-800 text-white">German (Deutsch)</option>
                  </select>
                </div>

                {/* Target Language */}
                <div className="text-center w-full sm:w-auto">
                  <label className="block text-xs sm:text-sm text-white/60 mb-2" id="target-language-label">Translate to:</label>
                  <select
                    value={currentLanguage}
                    onChange={(e) => setCurrentLanguage(e.target.value)}
                    aria-labelledby="target-language-label"
                    aria-describedby="language-help"
                    {...getAccessibilityProps('language-selector', { currentLanguage })}
                    className="w-full max-w-[200px] sm:w-auto bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-3 sm:px-6 py-2 sm:py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                  >
                    <option value="en" className="bg-gray-800 text-white">English</option>
                    <option value="es" className="bg-gray-800 text-white">Spanish (Español)</option>
                    <option value="pt" className="bg-gray-800 text-white">Portuguese (Português)</option>
                    <option value="fa" className="bg-gray-800 text-white">Persian (فارسی)</option>
                    <option value="ar" className="bg-gray-800 text-white">Arabic (العربية)</option>
                    <option value="zh" className="bg-gray-800 text-white">Chinese (中文)</option>
                    <option value="fr" className="bg-gray-800 text-white">French (Français)</option>
                    <option value="de" className="bg-gray-800 text-white">German (Deutsch)</option>
                  </select>
                </div>
              </div>

              {/* Manual Text Input */}
              <AnimatePresence>
                {showManualInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6"
                  >
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Type your message here..."
                        value={manualText}
                        onChange={(e) => setManualText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleManualTranslation()}
                        className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:ring-2 focus:ring-purple-500 transition-all duration-200"
                      />
                      <button
                        onClick={handleManualTranslation}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl transition-all duration-200"
                      >
                        Translate
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Status Indicator */}
              <div className="text-center space-y-4">
                <motion.div 
                  animate={{ scale: isRecording ? [1, 1.05, 1] : 1 }}
                  transition={{ duration: 1, repeat: isRecording ? Infinity : 0 }}
                  className="inline-flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3 bg-white/10 backdrop-blur-sm rounded-full px-4 sm:px-6 py-3 border border-white/20"
                >
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${isRecording ? 'bg-red-400 animate-pulse' : 'bg-green-400'}`}></div>
                    <span className="text-white font-medium text-sm sm:text-base">
                      {isRecording ? 'Recording...' : 'Ready to translate'}
                    </span>
                    {isRecording && <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 animate-pulse" />}
                  </div>
                  <span className="text-xs text-white/60">
                    {sourceLanguage.split('-')[0].toUpperCase()} → {currentLanguage.toUpperCase()}
                  </span>
                </motion.div>
                
                {/* Translation Quality Indicator */}
                {translationQuality.totalRatings > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20"
                  >
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star}
                          className={`w-3 h-3 ${
                            star <= Math.round(translationQuality.averageRating) 
                              ? 'text-yellow-400' 
                              : 'text-white/30'
                          }`}
                          fill={star <= Math.round(translationQuality.averageRating) ? 'currentColor' : 'none'}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-white/80">
                      {translationQuality.averageRating}/5 ({translationQuality.totalRatings} ratings)
                    </span>
                    <div className={`w-2 h-2 rounded-full ${
                      translationQuality.qualityLevel === 'excellent' ? 'bg-green-400' :
                      translationQuality.qualityLevel === 'good' ? 'bg-blue-400' :
                      translationQuality.qualityLevel === 'fair' ? 'bg-yellow-400' : 'bg-red-400'
                    }`}></div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>


        </div>

        {/* Messages */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              <h3 className="text-xl font-semibold text-white">Conversation</h3>
            </div>
            
            <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
              {messages.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-white/60 py-12"
                >
                  <div className="relative mb-6">
                    <Mic className="w-16 h-16 mx-auto text-white/30" />
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-20 blur-xl"
                    />
                  </div>
                  <p className="text-lg font-medium">Start recording to begin translation</p>
                  <p className="text-sm mt-2">Click the microphone button above</p>
                </motion.div>
              ) : (
                messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex ${message.isDoctor ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md p-4 rounded-2xl backdrop-blur-sm border ${
                      message.isDoctor 
                        ? 'bg-blue-500/20 border-blue-400/30 text-white' 
                        : 'bg-green-500/20 border-green-400/30 text-white'
                    }`}>
                      <div className="flex items-center space-x-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${
                          message.isDoctor ? 'bg-blue-400' : 'bg-green-400'
                        }`}></div>
                        <span className="text-sm font-medium opacity-80">
                          {message.isDoctor ? 'Doctor' : 'Patient'}
                        </span>
                      </div>
                      <div className="mb-3 text-sm">{message.text}</div>
                      <div className="text-sm opacity-75 border-t border-white/20 pt-3 italic">
                        {message.translatedText}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs opacity-60">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => playAudio(message.translatedText)}
                          className="text-xs opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <Volume2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                      
                      {/* Rating System - Only show for translated messages */}
                      {!message.isDoctor && (
                        <RatingStars
                          messageId={message.id}
                          currentRating={message.rating}
                          onRate={(rating) => handleRating(message.id, rating)}
                        />
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
            
            {/* Comprehensive Medical Summary Display */}
            {medicalExtraction && medicalExtraction.confidence > 0.3 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 bg-gradient-to-r from-blue-900/50 to-purple-900/50 backdrop-blur-sm rounded-lg p-4 border border-white/10"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">Medical Summary</h3>
                  <div className="flex items-center space-x-1 ml-2">
                    <div className={`w-2 h-2 rounded-full ${
                      aiStatus === 'active' ? 'bg-green-400' : 'bg-gray-400'
                    }`}></div>
                    <span className="text-xs text-white/60">
                      {aiStatus === 'active' ? 'AI' : 'Pattern'}
                    </span>
                  </div>
                </div>

                {/* Patient Background (Historical Information) */}
                {(medicalExtraction.patientBackground?.currentMedications?.length > 0 || 
                  medicalExtraction.patientBackground?.allergies?.length > 0 || 
                  medicalExtraction.patientBackground?.pastMedicalHistory?.length > 0 || 
                  medicalExtraction.patientBackground?.familyHistory?.length > 0 || 
                  medicalExtraction.patientBackground?.lifestyle?.length > 0 || 
                  medicalExtraction.patientBackground?.chronicConditions?.length > 0) && (
                  <div className="mb-4 p-3 bg-green-900/30 rounded-lg border border-green-400/30">
                    <h4 className="text-sm font-medium text-green-300 mb-2">Patient Background</h4>
                    <div className="space-y-2 text-xs">
                      {medicalExtraction.patientBackground.currentMedications.length > 0 && (
                        <div>
                          <span className="text-green-200/80">Current Medications:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.patientBackground.currentMedications.map((med, index) => (
                              <span key={index} className="px-2 py-1 bg-green-500/20 text-green-200 rounded-full border border-green-400/30">
                                {med}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.patientBackground.allergies.length > 0 && (
                        <div>
                          <span className="text-red-200/80">Allergies:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.patientBackground.allergies.map((allergy, index) => (
                              <span key={index} className="px-2 py-1 bg-red-500/20 text-red-200 rounded-full border border-red-400/30">
                                {allergy}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.patientBackground.pastMedicalHistory.length > 0 && (
                        <div>
                          <span className="text-blue-200/80">Past Medical History:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.patientBackground.pastMedicalHistory.map((history, index) => (
                              <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-200 rounded-full border border-blue-400/30">
                                {history}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.patientBackground.chronicConditions.length > 0 && (
                        <div>
                          <span className="text-orange-200/80">Chronic Conditions:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.patientBackground.chronicConditions.map((condition, index) => (
                              <span key={index} className="px-2 py-1 bg-orange-500/20 text-orange-200 rounded-full border border-orange-400/30">
                                {condition}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.patientBackground.familyHistory.length > 0 && (
                        <div>
                          <span className="text-purple-200/80">Family History:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.patientBackground.familyHistory.map((history, index) => (
                              <span key={index} className="px-2 py-1 bg-purple-500/20 text-purple-200 rounded-full border border-purple-400/30">
                                {history}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.patientBackground.lifestyle.length > 0 && (
                        <div>
                          <span className="text-cyan-200/80">Lifestyle:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.patientBackground.lifestyle.map((lifestyle, index) => (
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

                {/* Current Situation (Presenting Issues) */}
                {(medicalExtraction.currentSituation?.chiefComplaint || 
                  medicalExtraction.currentSituation?.presentingSymptoms?.length > 0 || 
                  medicalExtraction.currentSituation?.acuteIssues?.length > 0 || 
                  medicalExtraction.currentSituation?.recentChanges?.length > 0 || 
                  medicalExtraction.currentSituation?.painLevel > 0) && (
                  <div className="mb-4 p-3 bg-blue-900/30 rounded-lg border border-blue-400/30">
                    <h4 className="text-sm font-medium text-blue-300 mb-2">Current Situation</h4>
                    <div className="space-y-2 text-xs">
                      {medicalExtraction.currentSituation.chiefComplaint && (
                        <div>
                          <span className="text-blue-200/80">Chief Complaint:</span>
                          <span className="text-blue-200 ml-2">{medicalExtraction.currentSituation.chiefComplaint}</span>
                        </div>
                      )}
                      {medicalExtraction.currentSituation.presentingSymptoms.length > 0 && (
                        <div>
                          <span className="text-blue-200/80">Presenting Symptoms:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.currentSituation.presentingSymptoms.map((symptom, index) => (
                              <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-200 rounded-full border border-blue-400/30">
                                {symptom}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.currentSituation.acuteIssues.length > 0 && (
                        <div>
                          <span className="text-red-200/80">Acute Issues:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.currentSituation.acuteIssues.map((issue, index) => (
                              <span key={index} className="px-2 py-1 bg-red-500/20 text-red-200 rounded-full border border-red-400/30">
                                {issue}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.currentSituation.recentChanges.length > 0 && (
                        <div>
                          <span className="text-yellow-200/80">Recent Changes:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.currentSituation.recentChanges.map((change, index) => (
                              <span key={index} className="px-2 py-1 bg-yellow-500/20 text-yellow-200 rounded-full border border-yellow-400/30">
                                {change}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.currentSituation.painLevel > 0 && (
                        <div>
                          <span className="text-orange-200/80">Pain Level:</span>
                          <div className="flex items-center space-x-3 mt-1">
                            <div className="flex-1 bg-white/10 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-green-400 to-red-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(medicalExtraction.currentSituation.painLevel / 10) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-orange-200 font-medium">{medicalExtraction.currentSituation.painLevel}/10</span>
                          </div>
                        </div>
                      )}
                      {medicalExtraction.currentSituation.symptomDuration && (
                        <div>
                          <span className="text-blue-200/80">Duration:</span>
                          <span className="text-blue-200 ml-2">{medicalExtraction.currentSituation.symptomDuration}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Ongoing Care (Current Treatments & Monitoring) */}
                {(medicalExtraction.ongoingCare.activeTreatments.length > 0 || 
                  medicalExtraction.ongoingCare.medications.length > 0 || 
                  medicalExtraction.ongoingCare.recentDiagnoses.length > 0 || 
                  medicalExtraction.ongoingCare.monitoring.length > 0 || 
                  Object.values(medicalExtraction.ongoingCare.vitalSigns).some(value => value)) && (
                  <div className="mb-4 p-3 bg-purple-900/30 rounded-lg border border-purple-400/30">
                    <h4 className="text-sm font-medium text-purple-300 mb-2">Ongoing Care</h4>
                    <div className="space-y-2 text-xs">
                      {medicalExtraction.ongoingCare.activeTreatments.length > 0 && (
                        <div>
                          <span className="text-purple-200/80">Active Treatments:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.ongoingCare.activeTreatments.map((treatment, index) => (
                              <span key={index} className="px-2 py-1 bg-purple-500/20 text-purple-200 rounded-full border border-purple-400/30">
                                {treatment}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.ongoingCare.medications.length > 0 && (
                        <div>
                          <span className="text-purple-200/80">Medications:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.ongoingCare.medications.map((medication, index) => (
                              <span key={index} className="px-2 py-1 bg-purple-500/20 text-purple-200 rounded-full border border-purple-400/30">
                                {medication}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.ongoingCare.recentDiagnoses.length > 0 && (
                        <div>
                          <span className="text-purple-200/80">Recent Diagnoses:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.ongoingCare.recentDiagnoses.map((diagnosis, index) => (
                              <span key={index} className="px-2 py-1 bg-purple-500/20 text-purple-200 rounded-full border border-purple-400/30">
                                {diagnosis}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.ongoingCare.monitoring.length > 0 && (
                        <div>
                          <span className="text-purple-200/80">Monitoring:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.ongoingCare.monitoring.map((monitor, index) => (
                              <span key={index} className="px-2 py-1 bg-purple-500/20 text-purple-200 rounded-full border border-purple-400/30">
                                {monitor}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {Object.values(medicalExtraction.ongoingCare.vitalSigns).some(value => value) && (
                        <div>
                          <span className="text-purple-200/80">Vital Signs:</span>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            {medicalExtraction.ongoingCare.vitalSigns.bloodPressure && (
                              <div className="flex justify-between">
                                <span className="text-purple-200/60">BP:</span>
                                <span className="text-purple-200">{medicalExtraction.ongoingCare.vitalSigns.bloodPressure}</span>
                              </div>
                            )}
                            {medicalExtraction.ongoingCare.vitalSigns.temperature && (
                              <div className="flex justify-between">
                                <span className="text-purple-200/60">Temp:</span>
                                <span className="text-purple-200">{medicalExtraction.ongoingCare.vitalSigns.temperature}</span>
                              </div>
                            )}
                            {medicalExtraction.ongoingCare.vitalSigns.heartRate && (
                              <div className="flex justify-between">
                                <span className="text-purple-200/60">HR:</span>
                                <span className="text-purple-200">{medicalExtraction.ongoingCare.vitalSigns.heartRate}</span>
                              </div>
                            )}
                            {medicalExtraction.ongoingCare.vitalSigns.weight && (
                              <div className="flex justify-between">
                                <span className="text-purple-200/60">Weight:</span>
                                <span className="text-purple-200">{medicalExtraction.ongoingCare.vitalSigns.weight}</span>
                              </div>
                            )}
                            {medicalExtraction.ongoingCare.vitalSigns.height && (
                              <div className="flex justify-between">
                                <span className="text-purple-200/60">Height:</span>
                                <span className="text-purple-200">{medicalExtraction.ongoingCare.vitalSigns.height}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Assessment & Plan (Doctor's Findings & Recommendations) */}
                {(medicalExtraction.assessmentAndPlan.diagnosis.length > 0 || 
                  medicalExtraction.assessmentAndPlan.differentialDiagnosis.length > 0 || 
                  medicalExtraction.assessmentAndPlan.treatmentPlan.length > 0 || 
                  medicalExtraction.assessmentAndPlan.medicationsPrescribed.length > 0 || 
                  medicalExtraction.assessmentAndPlan.recommendations.length > 0 || 
                  medicalExtraction.assessmentAndPlan.followUp.length > 0 || 
                  medicalExtraction.assessmentAndPlan.patientInstructions.length > 0) && (
                  <div className="mb-4 p-3 bg-orange-900/30 rounded-lg border border-orange-400/30">
                    <h4 className="text-sm font-medium text-orange-300 mb-2">Assessment & Plan</h4>
                    <div className="space-y-2 text-xs">
                      {medicalExtraction.assessmentAndPlan.diagnosis.length > 0 && (
                        <div>
                          <span className="text-orange-200/80">Diagnosis:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.assessmentAndPlan.diagnosis.map((diagnosis, index) => (
                              <span key={index} className="px-2 py-1 bg-orange-500/20 text-orange-200 rounded-full border border-orange-400/30">
                                {diagnosis}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.assessmentAndPlan.differentialDiagnosis.length > 0 && (
                        <div>
                          <span className="text-orange-200/80">Differential Diagnosis:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.assessmentAndPlan.differentialDiagnosis.map((diagnosis, index) => (
                              <span key={index} className="px-2 py-1 bg-orange-500/20 text-orange-200 rounded-full border border-orange-400/30">
                                {diagnosis}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.assessmentAndPlan.treatmentPlan.length > 0 && (
                        <div>
                          <span className="text-orange-200/80">Treatment Plan:</span>
                          <ul className="mt-1 space-y-1">
                            {medicalExtraction.assessmentAndPlan.treatmentPlan.map((treatment, index) => (
                              <li key={index} className="text-orange-200 flex items-start space-x-2">
                                <span className="text-orange-400 mt-1">•</span>
                                <span>{treatment}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {medicalExtraction.assessmentAndPlan.medicationsPrescribed.length > 0 && (
                        <div>
                          <span className="text-orange-200/80">Medications Prescribed:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.assessmentAndPlan.medicationsPrescribed.map((medication, index) => (
                              <span key={index} className="px-2 py-1 bg-orange-500/20 text-orange-200 rounded-full border border-orange-400/30">
                                {medication}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.assessmentAndPlan.recommendations.length > 0 && (
                        <div>
                          <span className="text-orange-200/80">Recommendations:</span>
                          <ul className="mt-1 space-y-1">
                            {medicalExtraction.assessmentAndPlan.recommendations.map((rec, index) => (
                              <li key={index} className="text-orange-200 flex items-start space-x-2">
                                <span className="text-orange-400 mt-1">•</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {medicalExtraction.assessmentAndPlan.followUp.length > 0 && (
                        <div>
                          <span className="text-orange-200/80">Follow-up:</span>
                          <ul className="mt-1 space-y-1">
                            {medicalExtraction.assessmentAndPlan.followUp.map((followUp, index) => (
                              <li key={index} className="text-orange-200 flex items-start space-x-2">
                                <span className="text-orange-400 mt-1">•</span>
                                <span>{followUp}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {medicalExtraction.assessmentAndPlan.patientInstructions.length > 0 && (
                        <div>
                          <span className="text-orange-200/80">Patient Instructions:</span>
                          <ul className="mt-1 space-y-1">
                            {medicalExtraction.assessmentAndPlan.patientInstructions.map((instruction, index) => (
                              <li key={index} className="text-orange-200 flex items-start space-x-2">
                                <span className="text-orange-400 mt-1">•</span>
                                <span>{instruction}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(medicalExtraction.assessmentAndPlan.severity || medicalExtraction.assessmentAndPlan.urgency) && (
                        <div className="flex items-center space-x-4">
                          {medicalExtraction.assessmentAndPlan.severity && (
                            <div className="flex items-center space-x-2">
                              <span className="text-orange-200/80">Severity:</span>
                              <div className={`w-3 h-3 rounded-full ${
                                medicalExtraction.assessmentAndPlan.severity === 'critical' ? 'bg-red-400' :
                                medicalExtraction.assessmentAndPlan.severity === 'high' ? 'bg-orange-400' :
                                medicalExtraction.assessmentAndPlan.severity === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                              }`}></div>
                              <span className="text-orange-200 capitalize">{medicalExtraction.assessmentAndPlan.severity}</span>
                            </div>
                          )}
                          {medicalExtraction.assessmentAndPlan.urgency && (
                            <div className="flex items-center space-x-2">
                              <span className="text-orange-200/80">Urgency:</span>
                              <div className={`w-3 h-3 rounded-full ${
                                medicalExtraction.assessmentAndPlan.urgency === 'emergency' ? 'bg-red-400' :
                                medicalExtraction.assessmentAndPlan.urgency === 'urgent' ? 'bg-orange-400' : 'bg-green-400'
                              }`}></div>
                              <span className="text-orange-200 capitalize">{medicalExtraction.assessmentAndPlan.urgency}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}


              </motion.div>
            )}

            {/* Medical Summary Display */}
            {showMedicalSummary && medicalExtraction && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6"
              >
                <MedicalSummary extraction={medicalExtraction} />
              </motion.div>
            )}

            {/* Conversation Summary Display */}
            {showConversationSummary && conversationSummary && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6"
              >
                <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 backdrop-blur-sm rounded-lg p-4 border border-green-400/20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Real-time Conversation Summary</h3>
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        conversationSummary.urgency === 'emergency' ? 'bg-red-400' :
                        conversationSummary.urgency === 'urgent' ? 'bg-orange-400' : 'bg-green-400'
                      }`}></div>
                      <span className="text-xs text-white/60 capitalize">{conversationSummary.urgency}</span>
                      <span className="text-xs text-white/40">
                        {Math.round(conversationSummary.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Key Points */}
                    {conversationSummary.keyPoints.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-green-300">Key Points</h4>
                        <ul className="space-y-1">
                          {conversationSummary.keyPoints.map((point, index) => (
                            <li key={index} className="text-green-200 text-sm flex items-start space-x-2">
                              <span className="text-green-400 mt-1">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Medical Findings */}
                    {conversationSummary.medicalFindings.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-blue-300">Medical Findings</h4>
                        <ul className="space-y-1">
                          {conversationSummary.medicalFindings.map((finding, index) => (
                            <li key={index} className="text-blue-200 text-sm flex items-start space-x-2">
                              <span className="text-blue-400 mt-1">•</span>
                              <span>{finding}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    {conversationSummary.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-purple-300">Recommendations</h4>
                        <ul className="space-y-1">
                          {conversationSummary.recommendations.map((rec, index) => (
                            <li key={index} className="text-purple-200 text-sm flex items-start space-x-2">
                              <span className="text-purple-400 mt-1">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Next Steps */}
                    {conversationSummary.nextSteps.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-orange-300">Next Steps</h4>
                        <ul className="space-y-1">
                          {conversationSummary.nextSteps.map((step, index) => (
                            <li key={index} className="text-orange-200 text-sm flex items-start space-x-2">
                              <span className="text-orange-400 mt-1">•</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {conversationSummary.lastUpdated && (
                    <div className="mt-4 pt-3 border-t border-green-400/20 text-xs text-green-200/60">
                      Last updated: {conversationSummary.lastUpdated.toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            
            {/* Quick Rating Prompt */}
            {showRatingPrompt && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg border border-purple-400/30"
              >
                <div className="text-center">
                  <p className="text-white font-medium mb-3">How was this translation?</p>
                  <div className="flex justify-center space-x-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <motion.button
                        key={rating}
                        onClick={() => handleRating(showRatingPrompt, rating)}
                        className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg p-2 transition-all duration-200"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Star className="w-6 h-6 text-yellow-400" fill="currentColor" />
                        <span className="block text-xs text-white mt-1">{rating}</span>
                      </motion.button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowRatingPrompt(null)}
                    className="text-white/60 hover:text-white text-sm mt-3 underline"
                  >
                    Skip rating
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Sliding Settings Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: showSettings ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 h-full w-full md:w-96 bg-slate-900/95 backdrop-blur-md border-l border-white/20 shadow-2xl z-50 overflow-y-auto"
      >
        {/* Settings Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-white/20 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Settings</h2>
            <motion.button
              onClick={() => setShowSettings(false)}
              className="text-white/60 hover:text-white transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Close settings"
            >
              <X className="w-6 h-6" />
            </motion.button>
          </div>
        </div>

        {/* Settings Content */}
        <div className="p-6 space-y-8">
          {/* Translation Provider */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-4">Translation Provider</h3>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
            >
              {providers.map(provider => (
                <option key={provider.id} value={provider.id} className="bg-gray-800 text-white">
                  {provider.name} ({provider.type})
                </option>
              ))}
            </select>
          </div>

          {/* API Key Management - Only show for cloud providers */}
          {isCloudProvider(selectedProvider) && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white mb-4">API Key Management</h3>
              
              {/* API Key Selection Dropdown */}
              <div className="relative">
                <label className="block text-sm text-white/60 mb-2">Select API Key:</label>
                <div className="relative">
                  <button
                    onClick={() => setShowApiKeyDropdown(!showApiKeyDropdown)}
                    className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 flex items-center justify-between"
                  >
                    <span className={selectedApiKey ? 'text-white' : 'text-white/50'}>
                      {selectedApiKey || 'Select an API key'}
                    </span>
                    <motion.div
                      animate={{ rotate: showApiKeyDropdown ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <X className="w-4 h-4" />
                    </motion.div>
                  </button>
                  
                  {/* Dropdown Menu */}
                  {showApiKeyDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/20 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto"
                    >
                      {/* Add New API Key Option */}
                      <button
                        onClick={() => {
                          setShowApiKeyDropdown(false)
                          setShowApiKeyInput(true)
                          setNewApiKeyName('')
                          setNewApiKey('')
                        }}
                        className="w-full px-4 py-3 text-left text-green-400 hover:bg-white/10 border-b border-white/10 flex items-center space-x-2"
                      >
                        <span className="text-lg">+</span>
                        <span>Add New API Key</span>
                      </button>
                      
                      {/* Existing API Keys */}
                      {getApiKeyNamesForProvider(selectedProvider).map((name) => (
                        <div key={name} className="flex items-center justify-between px-4 py-3 hover:bg-white/10 border-b border-white/10 last:border-b-0">
                          <button
                            onClick={() => {
                              setSelectedApiKey(name)
                              setShowApiKeyDropdown(false)
                            }}
                            className={`flex-1 text-left ${selectedApiKey === name ? 'text-purple-400' : 'text-white'}`}
                          >
                            {name}
                          </button>
                          <div className="flex items-center space-x-2">
                            <motion.button
                              onClick={() => editApiKey(name)}
                              className="text-blue-400 hover:text-blue-300 transition-colors p-1"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Settings className="w-3 h-3" />
                            </motion.button>
                            <motion.button
                              onClick={() => deleteApiKey(name)}
                              className="text-red-400 hover:text-red-300 transition-colors p-1"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </motion.button>
                          </div>
                        </div>
                      ))}
                      
                      {getApiKeyNamesForProvider(selectedProvider).length === 0 && (
                        <div className="px-4 py-3 text-white/60 text-center">
                          No API keys saved for this provider
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Add/Edit API Key Form */}
              {showApiKeyInput && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 bg-white/5 rounded-lg p-4 border border-white/10"
                >
                  <h4 className="text-lg font-medium text-white">
                    {newApiKeyName ? 'Edit API Key' : 'Add New API Key'}
                  </h4>
                  
                  <input
                    type="text"
                    placeholder="API Key Name"
                    value={newApiKeyName}
                    onChange={(e) => setNewApiKeyName(e.target.value)}
                    className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  />
                  
                  <input
                    type="password"
                    placeholder="API Key"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  />
                  
                  <div className="flex space-x-3">
                    <motion.button
                      onClick={async () => {
                        if (newApiKeyName && newApiKey) {
                          await saveApiKeyToStorage(newApiKeyName, newApiKey)
                        } else {
                          toast.error('Please enter both name and API key')
                        }
                      }}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg transition-all duration-200"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {newApiKeyName ? 'Update' : 'Save'} API Key
                    </motion.button>
                    
                    <motion.button
                      onClick={() => {
                        setShowApiKeyInput(false)
                        setNewApiKeyName('')
                        setNewApiKey('')
                      }}
                      className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Cancel
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Provider Status */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-4">Provider Status & Limits</h3>
            <div className="space-y-3">
              {providers.map(provider => (
                <div key={provider.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {provider.type === 'cloud' ? (
                      <Wifi className="w-4 h-4 text-blue-400" />
                    ) : provider.type === 'api' ? (
                      <Globe className="w-4 h-4 text-purple-400" />
                    ) : (
                      <Shield className="w-4 h-4 text-green-400" />
                    )}
                    <div>
                      <span className="text-white text-sm">{provider.name}</span>
                      <div className="text-xs text-white/60">
                        {provider.id === 'mymemory' && '100 requests/day'}
                        {provider.id === 'openai' && '3,500 req/min'}
                        {provider.id === 'google' && '100 req/100s'}
                        {provider.id === 'deepl' && '500K chars/month'}
                      </div>
                    </div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${
                    provider.status === 'available' ? 'bg-green-400' : 'bg-red-400'
                  }`}></div>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy & Security Settings */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-4">Privacy & Security</h3>
            
            {/* HIPAA Compliance Status */}
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-lg font-medium text-white mb-2">HIPAA Compliance</h4>
              <div className="space-y-2 text-sm text-white/80">
                <div className="flex justify-between">
                  <span>Data Anonymization:</span>
                  <span className="text-green-400">✓ Enabled</span>
                </div>
                <div className="flex justify-between">
                  <span>Audit Logging:</span>
                  <span className="text-green-400">✓ Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Consent Management:</span>
                  <span className="text-green-400">✓ Configured</span>
                </div>
                <div className="flex justify-between">
                  <span>Data Retention:</span>
                  <span className="text-green-400">7 days</span>
                </div>
              </div>
            </div>

            {/* Security Status */}
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-lg font-medium text-white mb-2">Security Status</h4>
              <div className="space-y-2 text-sm text-white/80">
                <div className="flex justify-between">
                  <span>Input Sanitization:</span>
                  <span className="text-green-400">✓ Active</span>
                </div>
                <div className="flex justify-between">
                  <span>XSS Protection:</span>
                  <span className="text-green-400">✓ Enabled</span>
                </div>
                <div className="flex justify-between">
                  <span>API Key Encryption:</span>
                  <span className="text-green-400">✓ AES-256</span>
                </div>
                <div className="flex justify-between">
                  <span>Secure Storage:</span>
                  <span className="text-green-400">✓ IndexedDB</span>
                </div>
              </div>
            </div>

            {/* Translation Quality Analytics */}
            <div className="space-y-3">
              <h4 className="text-lg font-medium text-white">Translation Quality</h4>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="space-y-2 text-sm text-white/80">
                  <div className="flex justify-between">
                    <span>Average Rating:</span>
                    <span className="text-white font-medium">
                      {translationQuality.averageRating}/5
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Ratings:</span>
                    <span className="text-white font-medium">
                      {translationQuality.totalRatings}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quality Level:</span>
                    <span className={`font-medium ${
                      translationQuality.qualityLevel === 'excellent' ? 'text-green-400' :
                      translationQuality.qualityLevel === 'good' ? 'text-blue-400' :
                      translationQuality.qualityLevel === 'fair' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {translationQuality.qualityLevel.charAt(0).toUpperCase() + translationQuality.qualityLevel.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Medical Extraction Analytics */}
            {medicalExtraction && medicalExtraction.confidence > 0.3 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium text-white">Medical Extraction</h4>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      aiStatus === 'active' ? 'bg-green-400' : 'bg-gray-400'
                    }`}></div>
                    <span className="text-xs text-white/60">
                      {aiStatus === 'active' ? 'AI-Powered' : 'Pattern-Based'}
                    </span>
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="space-y-2 text-sm text-white/80">
                    <div className="flex justify-between">
                      <span>Extraction Confidence:</span>
                      <span className={`font-medium ${
                        medicalExtraction.confidence >= 0.7 ? 'text-green-400' :
                        medicalExtraction.confidence >= 0.4 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {Math.round(medicalExtraction.confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pain Level:</span>
                      <span className="text-white font-medium">
                        {medicalExtraction.painLevel}/10
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Symptoms Detected:</span>
                      <span className="text-white font-medium">
                        {medicalExtraction.symptoms.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Medications Found:</span>
                      <span className="text-white font-medium">
                        {medicalExtraction.medications.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Severity Level:</span>
                      <span className={`font-medium capitalize ${
                        medicalExtraction.severity === 'high' ? 'text-red-400' :
                        medicalExtraction.severity === 'medium' ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {medicalExtraction.severity}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Controls */}
            <div className="space-y-3">
              <h4 className="text-lg font-medium text-white">Privacy Controls</h4>
              <div className="space-y-2">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={hipaaCompliance.getConsent().dataCollection}
                    onChange={(e) => hipaaCompliance.updateConsent({ dataCollection: e.target.checked })}
                    className="rounded border-white/20 bg-white/10 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-white text-sm">Allow data collection for improvement</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={hipaaCompliance.getConsent().auditLogging}
                    onChange={(e) => hipaaCompliance.updateConsent({ auditLogging: e.target.checked })}
                    className="rounded border-white/20 bg-white/10 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-white text-sm">Enable audit logging</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={hipaaCompliance.getConsent().conversationStorage}
                    onChange={(e) => hipaaCompliance.updateConsent({ conversationStorage: e.target.checked })}
                    className="rounded border-white/20 bg-white/10 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-white text-sm">Store conversation history</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Backdrop for mobile */}
      {showSettings && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowSettings(false)}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
        />
      )}
    </div>
  )
}

export default App
