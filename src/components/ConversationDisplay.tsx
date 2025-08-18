import { motion } from 'framer-motion'
import { Mic, Volume2 } from 'lucide-react'
import type { Message } from '../hooks/useConversation'

interface ConversationDisplayProps {
  messages: Message[]
  playAudio: (text: string) => void
  handleRating: (messageId: string, rating: number) => void
}

// RatingStars component
const RatingStars = ({ 
  messageId, 
  currentRating, 
  onRate 
}: { 
  messageId: string
  currentRating?: number
  onRate: (rating: number) => void 
}) => {
  return (
    <div className="flex items-center space-x-1 mt-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          onClick={() => onRate(star)}
          className="text-xs opacity-60 hover:opacity-100 transition-opacity"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <span className={`text-yellow-400 ${star <= (currentRating ?? 0) ? 'text-yellow-400' : 'text-white/30'}`}>
            ★
          </span>
        </motion.button>
      ))}
    </div>
  )
}

export const ConversationDisplay = ({ messages, playAudio, handleRating }: ConversationDisplayProps) => {
  return (
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
      </div>
    </motion.div>
  )
}
