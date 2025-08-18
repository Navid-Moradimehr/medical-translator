import { motion } from 'framer-motion'
import { 
  Mic, 
  MicOff,
  RotateCcw,
  Stethoscope,
  MessageSquare
} from 'lucide-react'
import { getAccessibilityProps, handleKeyboardNavigation } from '../utils/accessibility'
import type { MedicalExtraction } from '../utils/medicalExtraction'

interface RecordingControlsProps {
  isRecording: boolean
  showManualInput: boolean
  medicalExtraction: MedicalExtraction | null
  conversationSummary: any
  startRecording: () => void
  setShowManualInput: (show: boolean) => void
  clearMessages: () => void
  setShowMedicalSummaryModal: (show: boolean) => void
  setShowConversationSummaryModal: (show: boolean) => void
}

export const RecordingControls = ({
  isRecording,
  showManualInput,
  medicalExtraction,
  conversationSummary,
  startRecording,
  setShowManualInput,
  clearMessages,
  setShowMedicalSummaryModal,
  setShowConversationSummaryModal
}: RecordingControlsProps) => {
  return (
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
      
      {/* Medical Summary Button */}
      {medicalExtraction && medicalExtraction.confidence > 0.3 && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowMedicalSummaryModal(true)}
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

      {/* Conversation Summary Button */}
      {conversationSummary && conversationSummary.confidence > 0.5 && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowConversationSummaryModal(true)}
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
  )
}
