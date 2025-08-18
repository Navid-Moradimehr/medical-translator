import { motion, AnimatePresence } from 'framer-motion'
import { X, Shield, Globe, Key, Trash2, Edit } from 'lucide-react'

interface Provider {
  id: string
  name: string
  type: 'local' | 'cloud' | 'api'
  status: 'available' | 'unavailable'
}

interface SettingsPanelProps {
  showSettings: boolean
  setShowSettings: (show: boolean) => void
  providers: Provider[]
  selectedProvider: string
  setSelectedProvider: (provider: string) => void
  apiKeys: Record<string, string>
  apiKeyNames: Record<string, string[]>
  selectedApiKey: string
  setSelectedApiKey: (key: string) => void
  newApiKey: string
  setNewApiKey: (key: string) => void
  newApiKeyName: string
  setNewApiKeyName: (name: string) => void
  showApiKeyInput: boolean
  setShowApiKeyInput: (show: boolean) => void
  showApiKeyDropdown: boolean
  setShowApiKeyDropdown: (show: boolean) => void
  saveApiKeyToStorage: (name: string, key: string) => Promise<void>
  deleteApiKey: (name: string) => Promise<void>
  editApiKey: (name: string) => void
  isCloudProvider: (providerId: string) => boolean
  getApiKeyNamesForProvider: (providerId: string) => string[]
  hipaaCompliance: any
}

export const SettingsPanel = ({
  showSettings,
  setShowSettings,
  providers,
  selectedProvider,
  setSelectedProvider,
  apiKeys,
  apiKeyNames,
  selectedApiKey,
  setSelectedApiKey,
  newApiKey,
  setNewApiKey,
  newApiKeyName,
  setNewApiKeyName,
  showApiKeyInput,
  setShowApiKeyInput,
  showApiKeyDropdown,
  setShowApiKeyDropdown,
  saveApiKeyToStorage,
  deleteApiKey,
  editApiKey,
  isCloudProvider,
  getApiKeyNamesForProvider,
  hipaaCompliance
}: SettingsPanelProps) => {
  return (
    <AnimatePresence>
      {showSettings && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
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
            {/* API Provider Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <Globe className="w-5 h-5" />
                <span>Translation Provider</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {providers.map((provider) => (
                  <motion.button
                    key={provider.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedProvider(provider.id)}
                    className={`p-4 rounded-xl border transition-all duration-200 ${
                      selectedProvider === provider.id
                        ? 'bg-blue-500/20 border-blue-400/50 text-blue-200'
                        : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{provider.name}</div>
                        <div className="text-sm opacity-70 capitalize">{provider.type}</div>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${
                        provider.status === 'available' ? 'bg-green-400' : 'bg-red-400'
                      }`}></div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* API Key Management - Only show for providers that need API keys */}
            {selectedProvider !== 'mymemory' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <Key className="w-5 h-5" />
                  <span>API Key Management</span>
                </h3>
              
                {/* Provider-specific API keys */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white/80">API Keys for {providers.find(p => p.id === selectedProvider)?.name}</span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Add New Key
                    </motion.button>
                  </div>

                  {/* Add new API key */}
                  <AnimatePresence>
                    {showApiKeyInput && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 p-4 bg-white/5 rounded-lg border border-white/10"
                      >
                        <input
                          type="text"
                          placeholder="API Key Name"
                          value={newApiKeyName}
                          onChange={(e) => setNewApiKeyName(e.target.value)}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/50"
                        />
                        <input
                          type="password"
                          placeholder="API Key"
                          value={newApiKey}
                          onChange={(e) => setNewApiKey(e.target.value)}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/50"
                        />
                        <div className="flex space-x-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={async () => {
                              if (newApiKeyName && newApiKey) {
                                await saveApiKeyToStorage(newApiKeyName, newApiKey)
                                setNewApiKeyName('')
                                setNewApiKey('')
                                setShowApiKeyInput(false)
                              }
                            }}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                          >
                            Save
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setNewApiKeyName('')
                              setNewApiKey('')
                              setShowApiKeyInput(false)
                            }}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                          >
                            Cancel
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* API Key Dropdown */}
                  <div className="relative">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowApiKeyDropdown(!showApiKeyDropdown)}
                      className="w-full flex items-center justify-between p-3 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors"
                    >
                      <span>{selectedApiKey ? selectedApiKey.replace(`${selectedProvider}_`, '') : 'Select API Key'}</span>
                      <span className="text-white/50">▼</span>
                    </motion.button>
                    
                    <AnimatePresence>
                      {showApiKeyDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 mt-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg shadow-xl z-10"
                        >
                          {getApiKeyNamesForProvider(selectedProvider).length > 0 ? (
                            getApiKeyNamesForProvider(selectedProvider).map((keyName) => {
                              // Remove provider prefix for display
                              const displayName = keyName.replace(`${selectedProvider}_`, '')
                              return (
                                <div
                                  key={keyName}
                                  className="flex items-center justify-between p-3 hover:bg-white/10 cursor-pointer border-b border-white/10 last:border-b-0"
                                >
                                  <span
                                    className="text-white flex-1"
                                    onClick={() => {
                                      setSelectedApiKey(keyName)
                                      setShowApiKeyDropdown(false)
                                    }}
                                  >
                                    {displayName}
                                  </span>
                                  <div className="flex space-x-1">
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => editApiKey(keyName)}
                                      className="p-1 text-blue-400 hover:text-blue-300"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </motion.button>
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={async () => {
                                        if (window.confirm(`Delete API key "${keyName}"?`)) {
                                          await deleteApiKey(keyName)
                                        }
                                      }}
                                      className="p-1 text-red-400 hover:text-red-300"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </motion.button>
                                  </div>
                                </div>
                              )
                            })
                          ) : (
                            <div className="p-3 text-white/60 text-center">
                              No API keys saved for this provider
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )}

            {/* HIPAA Compliance Status */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>HIPAA Compliance Status</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(hipaaCompliance.getComplianceStatus()).map(([feature, status]) => (
                  <div key={feature} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-white capitalize">{feature.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <div className={`w-3 h-3 rounded-full ${
                      status ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
