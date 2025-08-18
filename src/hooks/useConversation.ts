import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { hipaaCompliance } from '../utils/hipaa'
import { ScreenReader } from '../utils/accessibility'

export interface Message {
  id: string
  text: string
  translatedText: string
  isDoctor: boolean
  timestamp: Date
  language: string
  rating?: number
  translationQuality?: 'poor' | 'fair' | 'good' | 'excellent'
}

export interface SavedCase {
  id: string
  name: string
  timestamp: string
  messages: Message[]
  medicalExtraction: any
  conversationSummary: any
  encrypted?: boolean
  encryptedData?: string
}

export const useConversation = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [isDoctor, setIsDoctor] = useState(true)
  const [messageRatings, setMessageRatings] = useState<Record<string, number>>({})
  const [showRatingPrompt, setShowRatingPrompt] = useState<string | null>(null)

  // Clear conversation
  const clearConversation = useCallback(() => {
    setMessages([])
    setMessageRatings({})
    setShowRatingPrompt(null)
    toast.success('Conversation cleared')
    
    // Log conversation clear for audit trail
    hipaaCompliance.logAuditEntry('conversation_cleared', {
      messageCount: messages.length
    })
  }, [messages.length])

  // Add message to conversation
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message])
    
    // Show rating prompt for patient messages
    if (!message.isDoctor) {
      setShowRatingPrompt(message.id)
      toast.success('Translation complete! Please rate the quality below.', { duration: 4000 })
    }
    
    // Announce translation to screen readers
    ScreenReader.announceTranslation(message.text, message.translatedText, message.language)
  }, [])

  // Handle translation rating
  const handleRating = useCallback((messageId: string, rating: number) => {
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
    
    toast.success(`Rating saved: ${rating} stars`)
    setShowRatingPrompt(null)
  }, [])

  // Get conversation statistics
  const getConversationStats = useCallback(() => {
    const doctorMessages = messages.filter(msg => msg.isDoctor)
    const patientMessages = messages.filter(msg => !msg.isDoctor)
    const ratedMessages = messages.filter(msg => msg.rating !== undefined)
    
    return {
      totalMessages: messages.length,
      doctorMessages: doctorMessages.length,
      patientMessages: patientMessages.length,
      ratedMessages: ratedMessages.length,
      averageRating: ratedMessages.length > 0 
        ? ratedMessages.reduce((sum, msg) => sum + (msg.rating || 0), 0) / ratedMessages.length 
        : 0
    }
  }, [messages])

  return {
    messages,
    setMessages,
    isDoctor,
    setIsDoctor,
    messageRatings,
    showRatingPrompt,
    setShowRatingPrompt,
    clearConversation,
    addMessage,
    handleRating,
    getConversationStats
  }
}
