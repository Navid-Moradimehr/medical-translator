import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'

interface StatusIndicatorProps {
  isRecording: boolean
  sourceLanguage: string
  currentLanguage: string
}

export const StatusIndicator = ({
  isRecording,
  sourceLanguage,
  currentLanguage
}: StatusIndicatorProps) => {
  return (
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
    </div>
  )
}
