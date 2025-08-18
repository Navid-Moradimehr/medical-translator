import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { sanitizeInput, encodeOutput } from '../utils/security'
import { hipaaCompliance } from '../utils/hipaa'
import { Message } from './useConversation'

export interface TranslationQuality {
  averageRating: number
  totalRatings: number
  qualityLevel: 'poor' | 'fair' | 'good' | 'excellent'
}

export const useTranslation = () => {
  const [currentLanguage, setCurrentLanguage] = useState('es')
  const [sourceLanguage, setSourceLanguage] = useState('en-US')
  const [translationQuality, setTranslationQuality] = useState<TranslationQuality>({
    averageRating: 0,
    totalRatings: 0,
    qualityLevel: 'good'
  })

  // Medical dictionary for common terms
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
  const enhanceTextWithMedicalTerms = useCallback((text: string, sourceLang: string, targetLang: string): string => {
    // For now, return the original text without enhancement to prevent duplication
    // The medical dictionary can be used for validation but not for text enhancement
    return text
  }, [])

  // Real translation function for MVP - supports OpenAI and free APIs
  const translateText = useCallback(async (
    text: string, 
    targetLang: string,
    selectedProvider: string,
    selectedApiKey: string,
    apiKeys: Record<string, string>
  ): Promise<string> => {
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
  }, [sourceLanguage, enhanceTextWithMedicalTerms])

  // Manual text translation
  const handleManualTranslation = useCallback(async (
    manualText: string,
    isDoctor: boolean,
    selectedProvider: string,
    selectedApiKey: string,
    apiKeys: Record<string, string>,
    addMessage: (message: Message) => void,
    playAudio: (text: string) => void
  ) => {
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
    
    const translatedText = await translateText(sanitizationResult.sanitized, currentLanguage, selectedProvider, selectedApiKey, apiKeys)
    
    const newMessage: Message = {
      id: Date.now().toString(),
      text: sanitizationResult.sanitized,
      translatedText: encodeOutput(translatedText), // Encode output for XSS protection
      isDoctor,
      timestamp: new Date(),
      language: currentLanguage
    }
    
    addMessage(newMessage)
    playAudio(translatedText)
    
    // Log translation for audit trail
    hipaaCompliance.logAuditEntry('manual_translation', {
      sourceLanguage: sourceLanguage,
      targetLanguage: currentLanguage,
      isDoctor,
      messageCount: 1
    })
  }, [currentLanguage, sourceLanguage, translateText])

  // Update translation quality
  const updateTranslationQuality = useCallback((newRating: number) => {
    setTranslationQuality(prev => {
      const newTotalRatings = prev.totalRatings + 1
      const newAverageRating = (prev.averageRating * prev.totalRatings + newRating) / newTotalRatings
      const newQualityLevel = newAverageRating <= 1.5 ? 'poor' : newAverageRating <= 2.5 ? 'fair' : newAverageRating <= 4 ? 'good' : 'excellent'
      
      return {
        averageRating: Math.round(newAverageRating * 10) / 10,
        totalRatings: newTotalRatings,
        qualityLevel: newQualityLevel
      }
    })
  }, [])

  return {
    currentLanguage,
    setCurrentLanguage,
    sourceLanguage,
    setSourceLanguage,
    translationQuality,
    translateText,
    handleManualTranslation,
    updateTranslationQuality,
    medicalDictionary
  }
}
