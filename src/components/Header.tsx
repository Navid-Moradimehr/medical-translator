import { motion } from 'framer-motion'
import { 
  Settings, 
  Sparkles,
  Menu,
  Save,
  FolderOpen,
  Trash,
  FileText
} from 'lucide-react'
import { getAccessibilityProps, handleKeyboardNavigation } from '../utils/accessibility'

interface HeaderProps {
  aiStatus: 'active' | 'inactive' | 'checking'
  aiMode: 'basic' | 'ai'
  activeModel: string
  showSettings: boolean
  showHamburgerMenu: boolean
  setShowSettings: (show: boolean) => void
  setShowHamburgerMenu: (show: boolean) => void
  toggleAiMode: () => void
  refreshSavedCases: () => void
  setShowSaveDialog: (show: boolean) => void
  setShowLoadDialog: (show: boolean) => void
  setShowDeleteDialog: (show: boolean) => void
  clearConversation: () => void
}

export const Header = ({
  aiStatus,
  aiMode,
  activeModel,
  showSettings,
  showHamburgerMenu,
  setShowSettings,
  setShowHamburgerMenu,
  toggleAiMode,
  refreshSavedCases,
  setShowSaveDialog,
  setShowLoadDialog,
  setShowDeleteDialog,
  clearConversation
}: HeaderProps) => {
  return (
    <header className="relative z-20 bg-white/5 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Left side - Hamburger Menu and Logo */}
          <div className="flex items-center space-x-4">
            {/* Hamburger Menu Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white p-2 rounded-xl transition-all duration-200"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-6" />
            </motion.button>

            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg sm:text-xl">MT</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-white font-bold text-lg sm:text-xl">Medical Translator</h1>
                <p className="text-white/60 text-xs">AI-Powered Healthcare Communication</p>
              </div>
            </div>
          </div>

          {/* Right side - Status and Controls */}
          <div className="flex items-center space-x-1 sm:space-x-4">
            {/* AI Status and Mode Toggle */}
            <div className="flex items-center space-x-1 sm:space-x-4">
              {/* AI Status Indicator */}
              <div className="hidden sm:flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-3 sm:px-4 py-2">
                <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${
                  aiStatus === 'active' ? 'bg-green-400 animate-pulse' :
                  aiStatus === 'inactive' ? 'bg-gray-400' : 'bg-yellow-400 animate-pulse'
                }`}></div>
                <span className={`text-white text-xs sm:text-sm font-medium ${
                  aiStatus === 'active' ? 'text-green-400' :
                  aiStatus === 'inactive' ? 'text-gray-400' : 'text-yellow-400'
                }`}>
                  {aiMode === 'ai' ? 'AI Mode' : 'Basic Mode'}
                </span>
              </div>

              {/* AI Mode Toggle Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleAiMode}
                className={`px-3 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 ${
                  aiMode === 'ai' 
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg' 
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                }`}
              >
                {aiMode === 'ai' ? '🤖 AI' : '🔧 Basic'}
              </motion.button>

              {/* Active Model Display */}
              {aiMode === 'ai' && activeModel && (
                <>
                  {/* Desktop version */}
                  <div className="hidden sm:flex items-center space-x-2 bg-green-500/20 backdrop-blur-sm rounded-full px-3 py-2 border border-green-500/30">
                    <Sparkles className="w-3 h-3 text-green-400" />
                    <span className="text-green-400 text-xs font-medium">
                      {activeModel}
                    </span>
                  </div>
                  {/* Mobile version */}
                  <div className="sm:hidden flex items-center space-x-1 bg-green-500/20 backdrop-blur-sm rounded-full px-2 py-1 border border-green-500/30">
                    <Sparkles className="w-2 h-2 text-green-400" />
                    <span className="text-green-400 text-xs font-medium">
                      {activeModel.split(' ')[0]}
                    </span>
                  </div>
                </>
              )}
            </div>
            
            
            {/* Settings Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSettings(!showSettings)}
              onKeyDown={(e) => handleKeyboardNavigation(e, () => setShowSettings(!showSettings))}
              {...getAccessibilityProps('settings', { showSettings })}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white px-2 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-200 flex items-center space-x-1 sm:space-x-2"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline text-xs sm:text-base">Settings</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Hamburger Menu Dropdown */}
      {showHamburgerMenu && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-4 z-[9999] bg-white/95 backdrop-blur-xl border border-white/30 rounded-xl shadow-2xl min-w-64 max-w-80 hamburger-menu"
        >
          <div className="p-4 space-y-2">
            {/* Save Option */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                refreshSavedCases()
                setShowSaveDialog(true)
                setShowHamburgerMenu(false)
              }}
              className="w-full flex items-center space-x-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 text-white"
            >
              <Save className="w-5 h-5" />
              <span>Save Case</span>
            </motion.button>

            {/* Load Option */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                refreshSavedCases()
                setShowLoadDialog(true)
                setShowHamburgerMenu(false)
              }}
              className="w-full flex items-center space-x-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 text-white"
            >
              <FolderOpen className="w-5 h-5" />
              <span>Load Case</span>
            </motion.button>

            {/* Clear Option */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (window.confirm('Are you sure you want to clear the current conversation? This action cannot be undone.')) {
                  clearConversation()
                }
              }}
              className="w-full flex items-center space-x-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 text-white"
            >
              <FileText className="w-5 h-5" />
              <span>Clear Conversation</span>
            </motion.button>

            {/* Delete Option */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                refreshSavedCases()
                setShowDeleteDialog(true)
                setShowHamburgerMenu(false)
              }}
              className="w-full flex items-center space-x-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 text-white"
            >
              <Trash className="w-5 h-5" />
              <span>Delete Cases</span>
            </motion.button>

            {/* New Case Option */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (window.confirm('Start a new case? This will clear the current conversation.')) {
                  clearConversation()
                }
              }}
              className="w-full flex items-center space-x-3 p-3 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-all duration-200 text-blue-300"
            >
              <span>🆕 New Case</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </header>
  )
}
