import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, FolderOpen, Trash2 } from 'lucide-react'

interface SavedCase {
  id: string
  name: string
  timestamp: string
  messages: any[]
  medicalExtraction: any
  conversationSummary: any
  encrypted?: boolean
  encryptedData?: string
}

interface SaveDialogProps {
  showSaveDialog: boolean
  setShowSaveDialog: (show: boolean) => void
  saveMode: 'new' | 'existing'
  setSaveMode: (mode: 'new' | 'existing') => void
  newFileName: string
  setNewFileName: (name: string) => void
  selectedFileToOverwrite: string
  setSelectedFileToOverwrite: (id: string) => void
  savedCases: SavedCase[]
  onSave: () => void
}

interface LoadDialogProps {
  showLoadDialog: boolean
  setShowLoadDialog: (show: boolean) => void
  selectedFileToLoad: string
  setSelectedFileToLoad: (id: string) => void
  savedCases: SavedCase[]
  onLoad: () => void
}

interface DeleteDialogProps {
  showDeleteDialog: boolean
  setShowDeleteDialog: (show: boolean) => void
  selectedFileToDelete: string
  setSelectedFileToDelete: (id: string) => void
  savedCases: SavedCase[]
  onDelete: () => void
}

export const SaveDialog = ({
  showSaveDialog,
  setShowSaveDialog,
  saveMode,
  setSaveMode,
  newFileName,
  setNewFileName,
  selectedFileToOverwrite,
  setSelectedFileToOverwrite,
  savedCases,
  onSave
}: SaveDialogProps) => {
  return (
    <AnimatePresence>
      {showSaveDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSaveDialog(false)}
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <Save className="w-5 h-5" />
                <span>Save Case</span>
              </h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowSaveDialog(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </motion.button>
            </div>

            <div className="p-6 space-y-4">
              {/* Save Mode Selection */}
              <div className="flex space-x-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSaveMode('new')}
                  className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                    saveMode === 'new'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  Save New File
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSaveMode('existing')}
                  className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                    saveMode === 'existing'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  Save to Existing
                </motion.button>
              </div>

              {/* New File Input */}
              {saveMode === 'new' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white">File Name</label>
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="Enter file name..."
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/50"
                    style={{ backgroundColor: '#1f2937', color: 'white' }}
                  />
                </div>
              )}

              {/* Existing Files Selection */}
              {saveMode === 'existing' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white">Select File to Overwrite</label>
                  <select
                    value={selectedFileToOverwrite}
                    onChange={(e) => setSelectedFileToOverwrite(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                    style={{ backgroundColor: '#1f2937', color: 'white' }}
                  >
                    <option value="" style={{ backgroundColor: '#1f2937', color: 'white' }}>Select a file...</option>
                    {savedCases.map((case_) => (
                      <option key={case_.id} value={case_.id} style={{ backgroundColor: '#1f2937', color: 'white' }}>
                        {case_.name} - {new Date(case_.timestamp).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-2 pt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onSave}
                  className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Save
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const LoadDialog = ({
  showLoadDialog,
  setShowLoadDialog,
  selectedFileToLoad,
  setSelectedFileToLoad,
  savedCases,
  onLoad
}: LoadDialogProps) => {
  return (
    <AnimatePresence>
      {showLoadDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowLoadDialog(false)}
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <FolderOpen className="w-5 h-5" />
                <span>Load Case</span>
              </h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowLoadDialog(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </motion.button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Select Case to Load</label>
                <select
                  value={selectedFileToLoad}
                  onChange={(e) => setSelectedFileToLoad(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                  style={{ backgroundColor: '#1f2937', color: 'white' }}
                >
                  <option value="" style={{ backgroundColor: '#1f2937', color: 'white' }}>Select a case...</option>
                  {savedCases.map((case_) => (
                    <option key={case_.id} value={case_.id} style={{ backgroundColor: '#1f2937', color: 'white' }}>
                      {case_.name} - {new Date(case_.timestamp).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-2 pt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowLoadDialog(false)}
                  className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onLoad}
                  className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Load
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const DeleteDialog = ({
  showDeleteDialog,
  setShowDeleteDialog,
  selectedFileToDelete,
  setSelectedFileToDelete,
  savedCases,
  onDelete
}: DeleteDialogProps) => {
  return (
    <AnimatePresence>
      {showDeleteDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDeleteDialog(false)}
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <Trash2 className="w-5 h-5" />
                <span>Delete Case</span>
              </h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowDeleteDialog(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </motion.button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Select Case to Delete</label>
                <select
                  value={selectedFileToDelete}
                  onChange={(e) => setSelectedFileToDelete(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                  style={{ backgroundColor: '#1f2937', color: 'white' }}
                >
                  <option value="" style={{ backgroundColor: '#1f2937', color: 'white' }}>Select a case...</option>
                  {savedCases.map((case_) => (
                    <option key={case_.id} value={case_.id} style={{ backgroundColor: '#1f2937', color: 'white' }}>
                      {case_.name} - {new Date(case_.timestamp).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-300 text-sm">
                  ⚠️ Warning: This action cannot be undone. The selected case will be permanently deleted.
                </p>
              </div>

              <div className="flex space-x-2 pt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteDialog(false)}
                  className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onDelete}
                  className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Delete
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
