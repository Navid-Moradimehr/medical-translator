import { motion, AnimatePresence } from 'framer-motion'

interface ManualTextInputProps {
  showManualInput: boolean
  manualText: string
  setManualText: (text: string) => void
  handleManualTranslation: () => void
}

export const ManualTextInput = ({
  showManualInput,
  manualText,
  setManualText,
  handleManualTranslation
}: ManualTextInputProps) => {
  return (
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
  )
}
