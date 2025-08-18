import { useState, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { sanitizeInput, encodeOutput } from '../utils/security'
import { hipaaCompliance } from '../utils/hipaa'
import { ScreenReader } from '../utils/accessibility'
import { Message } from './useConversation'

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export const useSpeechRecognition = () => {
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<any>(null)

  const startRecording = useCallback(async (
    sourceLanguage: string,
    currentLanguage: string,
    isDoctor: boolean,
    selectedProvider: string,
    selectedApiKey: string,
    apiKeys: Record<string, string>,
    translateText: (text: string, targetLang: string, provider: string, apiKey: string, keys: Record<string, string>) => Promise<string>,
    addMessage: (message: Message) => void,
    playAudio: (text: string) => void
  ) => {
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
          const translatedText = await translateText(sanitizationResult.sanitized, currentLanguage, selectedProvider, selectedApiKey, apiKeys)
          
          // Add message to conversation
          const newMessage: Message = {
            id: Date.now().toString(),
            text: sanitizationResult.sanitized,
            translatedText: encodeOutput(translatedText), // Encode output for XSS protection
            isDoctor,
            timestamp: new Date(),
            language: currentLanguage
          }
          
          addMessage(newMessage)
          
          // Auto-play the translated text
          playAudio(translatedText)
          
          // Log speech translation for audit trail
          hipaaCompliance.logAuditEntry('speech_translation', {
            sourceLanguage: sourceLanguage,
            targetLanguage: currentLanguage,
            isDoctor,
            messageCount: 1
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
  }, [isRecording])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsRecording(false)
      recognitionRef.current = null
    }
  }, [])

  const playAudio = useCallback((text: string, currentLanguage: string) => {
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
  }, [])

  return {
    isRecording,
    startRecording,
    stopRecording,
    playAudio
  }
}
