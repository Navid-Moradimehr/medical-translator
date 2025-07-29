import { useState, useEffect, useRef } from 'react'
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
  Globe
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

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
  const [selectedApiKey, setSelectedApiKey] = useState<string>('')
  const [newApiKey, setNewApiKey] = useState<string>('')
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [manualText, setManualText] = useState<string>('')
  const [showManualInput, setShowManualInput] = useState(false)

  // Load API keys from localStorage on component mount
  useEffect(() => {
    const savedKeys = localStorage.getItem('api_keys')
    if (savedKeys) {
      setApiKeys(JSON.parse(savedKeys))
    }
  }, [])

  // Save API keys to localStorage
  const saveApiKey = (name: string, key: string) => {
    const updatedKeys = { ...apiKeys, [name]: key }
    setApiKeys(updatedKeys)
    localStorage.setItem('api_keys', JSON.stringify(updatedKeys))
    setNewApiKey('')
    toast.success('API key saved!')
  }

  // Remove API key
  const removeApiKey = (name: string) => {
    const updatedKeys = { ...apiKeys }
    delete updatedKeys[name]
    setApiKeys(updatedKeys)
    localStorage.setItem('api_keys', JSON.stringify(updatedKeys))
    if (selectedApiKey === name) {
      setSelectedApiKey('')
    }
    toast.success('API key removed!')
  }

  // Manual text translation
  const handleManualTranslation = async () => {
    if (!manualText.trim()) {
      toast.error('Please enter some text')
      return
    }
    
    const translatedText = await translateText(manualText, currentLanguage)
    
    const newMessage: Message = {
      id: Date.now().toString(),
      text: manualText,
      translatedText,
      isDoctor,
      timestamp: new Date(),
      language: currentLanguage
    }
    
    setMessages(prev => [...prev, newMessage])
    playAudio(translatedText)
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
    const sourceDict = medicalDictionary[sourceLang]
    const targetDict = medicalDictionary[targetLang]
    
    if (!sourceDict || !targetDict) return text
    
    let enhancedText = text
    
    // Replace common medical terms with more accurate translations
    Object.keys(sourceDict).forEach(term => {
      const regex = new RegExp(term, 'gi')
      enhancedText = enhancedText.replace(regex, `${term} (${sourceDict[term]})`)
    })
    
    return enhancedText
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
        }
        
        recognition.onresult = async (event: any) => {
          const transcript = event.results[0][0].transcript
          
          console.log('Transcript:', transcript)
          
          setIsRecording(false)
          recognitionRef.current = null
          toast.dismiss()
          
          toast.success('Processing audio...')
          
          // Translate the transcript
          const translatedText = await translateText(transcript, currentLanguage)
          
          // Add message to conversation
          const newMessage: Message = {
            id: Date.now().toString(),
            text: transcript,
            translatedText,
            isDoctor,
            timestamp: new Date(),
            language: currentLanguage
          }
          
          setMessages(prev => [...prev, newMessage])
          
          // Auto-play the translated text
          playAudio(translatedText)
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
    toast.success('Conversation cleared')
  }

  // Removed test function - no longer needed

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
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
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-4"
            >
              <div className="relative">
                <Stethoscope className="w-10 h-10 text-white" />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"
                >
                  <Sparkles className="w-3 h-3 text-white" />
                </motion.div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  Medical Translator
                </h1>
                <p className="text-purple-200 text-sm">AI-Powered Medical Communication</p>
              </div>
            </motion.div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-green-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-400" />
                )}
                <span className="text-white text-sm">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSettings(!showSettings)}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white px-6 py-3 rounded-xl transition-all duration-200 flex items-center space-x-2"
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Translation Interface - Centered */}
          <div className="lg:col-span-2">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl"
            >
              {/* Role Indicator */}
              <div className="flex items-center justify-center mb-8">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-2 border border-white/20">
                  <div className="flex items-center space-x-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsDoctor(true)}
                      className={`flex items-center space-x-3 px-6 py-3 rounded-xl transition-all duration-300 ${
                        isDoctor 
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <User className="w-5 h-5" />
                      <span className="font-medium">Doctor</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsDoctor(false)}
                      className={`flex items-center space-x-3 px-6 py-3 rounded-xl transition-all duration-300 ${
                        !isDoctor 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <User className="w-5 h-5" />
                      <span className="font-medium">Patient</span>
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Recording Controls */}
              <div className="flex items-center justify-center space-x-8 mb-10">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white px-6 py-3 rounded-xl transition-all duration-200 flex items-center space-x-2"
                >
                  <span>Text Input</span>
                </motion.button>
                
                {/* Main Recording Button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={startRecording}
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300 ${
                    isRecording 
                      ? 'bg-gradient-to-r from-red-500 to-pink-600 animate-pulse' 
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                  }`}
                >
                  {isRecording ? (
                    <MicOff className="w-10 h-10" />
                  ) : (
                    <Mic className="w-10 h-10" />
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
                  className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white px-6 py-3 rounded-xl transition-all duration-200 flex items-center space-x-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Clear</span>
                </motion.button>
                

              </div>

              {/* Language Selectors */}
              <div className="flex items-center justify-center space-x-8 mb-8">
                {/* Source Language */}
                <div className="text-center">
                  <label className="block text-sm text-white/60 mb-2">Speak in:</label>
                  <select
                    value={sourceLanguage}
                    onChange={(e) => setSourceLanguage(e.target.value)}
                    className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-6 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
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
                <div className="text-center">
                  <label className="block text-sm text-white/60 mb-2">Translate to:</label>
                  <select
                    value={currentLanguage}
                    onChange={(e) => setCurrentLanguage(e.target.value)}
                    className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-6 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
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
              <div className="text-center">
                <motion.div 
                  animate={{ scale: isRecording ? [1, 1.05, 1] : 1 }}
                  transition={{ duration: 1, repeat: isRecording ? Infinity : 0 }}
                  className="inline-flex items-center space-x-3 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20"
                >
                  <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-400 animate-pulse' : 'bg-green-400'}`}></div>
                  <span className="text-white font-medium">
                    {isRecording ? 'Recording...' : 'Ready to translate'}
                  </span>
                  <span className="text-xs text-white/60">
                    {sourceLanguage.split('-')[0].toUpperCase()} → {currentLanguage.toUpperCase()}
                  </span>
                  {isRecording && <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />}
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, x: 300 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 300 }}
                className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl"
              >
                                  <div className="flex items-center space-x-3 mb-6">
                    <Settings className="w-6 h-6 text-white" />
                    <h3 className="text-xl font-semibold text-white">Settings</h3>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-3">
                        Translation Provider
                      </label>
                      <select
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 transition-all duration-200"
                      >
                      {providers.map(provider => (
                        <option key={provider.id} value={provider.id} className="bg-gray-800 text-white">
                          {provider.name} ({provider.type})
                        </option>
                      ))}
                    </select>
                  </div>

                                      <div>
                      <label className="block text-sm font-medium text-white/80 mb-3">
                        API Key Management
                      </label>
                      
                      {/* Selected API Key */}
                      <div className="mb-4">
                        <label className="block text-xs text-white/60 mb-2">Selected API Key:</label>
                        <select
                          value={selectedApiKey}
                          onChange={(e) => {
                            if (e.target.value === 'add-new') {
                              setShowApiKeyInput(true)
                              setSelectedApiKey('')
                            } else {
                              setSelectedApiKey(e.target.value)
                              setShowApiKeyInput(false)
                            }
                          }}
                          className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 transition-all duration-200"
                        >
                          <option value="" className="bg-gray-800 text-white">No API Key Selected</option>
                          <option value="add-new" className="bg-gray-800 text-white">+ Add API Key</option>
                          {Object.keys(apiKeys).map(key => (
                            <option key={key} value={key} className="bg-gray-800 text-white">
                              {key} ({apiKeys[key].substring(0, 8)}...)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Add New API Key - Show on demand */}
                      {showApiKeyInput && (
                        <div className="mb-4 p-4 bg-white/5 rounded-xl border border-white/10">
                          <label className="block text-xs text-white/60 mb-2">Add New API Key:</label>
                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="API Key Name"
                              value={newApiKey}
                              onChange={(e) => setNewApiKey(e.target.value)}
                              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:ring-2 focus:ring-purple-500 transition-all duration-200"
                            />
                            <input
                              type="password"
                              placeholder="sk-..."
                              id="apiKeyInput"
                              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:ring-2 focus:ring-purple-500 transition-all duration-200"
                            />
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {
                                  const keyInput = document.getElementById('apiKeyInput') as HTMLInputElement
                                  if (newApiKey && keyInput.value) {
                                    saveApiKey(newApiKey, keyInput.value)
                                    keyInput.value = ''
                                    setShowApiKeyInput(false)
                                  } else {
                                    toast.error('Please enter both name and API key')
                                  }
                                }}
                                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-xl transition-all duration-200"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setShowApiKeyInput(false)
                                  setNewApiKey('')
                                  const keyInput = document.getElementById('apiKeyInput') as HTMLInputElement
                                  if (keyInput) keyInput.value = ''
                                }}
                                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-xl transition-all duration-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Saved API Keys */}
                      {Object.keys(apiKeys).length > 0 && (
                        <div>
                          <label className="block text-xs text-white/60 mb-2">Saved API Keys:</label>
                          <div className="space-y-2">
                            {Object.keys(apiKeys).map(key => (
                              <div key={key} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                <span className="text-white text-sm">{key}</span>
                                <button
                                  onClick={() => removeApiKey(key)}
                                  className="text-red-400 hover:text-red-300 text-sm"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-white/20">
                      <h4 className="text-sm font-medium text-white/80 mb-4">Provider Status & Limits</h4>
                      <div className="space-y-3">
                        {providers.map(provider => (
                          <div key={provider.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default App
