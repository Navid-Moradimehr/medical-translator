import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { hipaaCompliance } from '../utils/hipaa'
import { medicalEncryption } from '../utils/medicalEncryption'
import { SavedCase, Message } from './useConversation'

export const useSavedCases = () => {
  const [savedCases, setSavedCases] = useState<SavedCase[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [saveMode, setSaveMode] = useState<'new' | 'existing'>('new')
  const [newFileName, setNewFileName] = useState('')
  const [selectedFileToOverwrite, setSelectedFileToOverwrite] = useState('')
  const [selectedFileToLoad, setSelectedFileToLoad] = useState('')
  const [selectedFileToDelete, setSelectedFileToDelete] = useState('')

  // Load saved cases from localStorage on component mount
  useEffect(() => {
    const loadSavedCases = () => {
      try {
        const saved = localStorage.getItem('medical_translator_saved_cases')
        console.log('📂 Loading saved cases from localStorage:', saved)
        if (saved && saved !== '[]') {
          const cases = JSON.parse(saved)
          console.log('📂 Parsed cases:', cases)
          if (Array.isArray(cases) && cases.length > 0) {
            setSavedCases(cases)
          }
        }
      } catch (error) {
        console.error('Failed to load saved cases:', error)
      }
    }
    loadSavedCases()
  }, [])

  // Save cases to localStorage whenever savedCases changes
  useEffect(() => {
    console.log('💾 Saving cases to localStorage:', savedCases)
    try {
      // Only save if we have actual cases or if this is the initial load
      if (savedCases.length > 0 || localStorage.getItem('medical_translator_saved_cases') === null) {
        localStorage.setItem('medical_translator_saved_cases', JSON.stringify(savedCases))
        console.log('✅ Cases saved to localStorage successfully')
      } else {
        console.log('⏭️ Skipping save - no cases to save and not initial load')
      }
    } catch (error) {
      console.error('❌ Failed to save cases to localStorage:', error)
    }
  }, [savedCases])

  // Function to refresh saved cases from localStorage
  const refreshSavedCases = useCallback(() => {
    try {
      const saved = localStorage.getItem('medical_translator_saved_cases')
      console.log('🔄 Refreshing saved cases from localStorage:', saved)
      if (saved && saved !== '[]') {
        const cases = JSON.parse(saved)
        console.log('🔄 Refreshed cases:', cases)
        if (Array.isArray(cases) && cases.length > 0) {
          setSavedCases(cases)
        } else {
          console.log('🔄 No valid cases found in localStorage')
        }
      } else {
        console.log('🔄 No saved cases found in localStorage')
      }
    } catch (error) {
      console.error('Failed to refresh saved cases:', error)
    }
  }, [])

  // Save current conversation and medical data
  const saveCurrentCase = useCallback(async (
    fileName: string, 
    overwriteId: string | undefined,
    messages: Message[],
    medicalExtraction: any,
    conversationSummary: any
  ) => {
    const caseData = {
      id: overwriteId || `case_${Date.now()}`,
      name: fileName,
      timestamp: new Date().toISOString(),
      messages: messages,
      medicalExtraction: medicalExtraction,
      conversationSummary: conversationSummary
    }

    console.log('💾 Saving case:', caseData)

    try {
      // Encrypt medical data before saving
      const encryptionResult = await medicalEncryption.encryptMedicalData(caseData, 'conversation')
      if (!encryptionResult.success) {
        console.error('Failed to encrypt case data:', encryptionResult.error)
        toast.error('Failed to encrypt case data')
        return
      }

      // Create encrypted case data
      const encryptedCaseData = {
        ...caseData,
        encrypted: true,
        encryptedData: encryptionResult.encryptedData
      }

      // Log the save operation for audit
      hipaaCompliance.logAuditEntry('case_saved', caseData, {
        dataType: 'conversation',
        severity: 'medium',
        details: { fileName, overwriteId, encrypted: true }
      })

      if (overwriteId) {
        // Update existing case
        setSavedCases(prev => {
          const updated = prev.map(case_ => 
            case_.id === overwriteId ? encryptedCaseData : case_
          )
          console.log('📝 Updated cases:', updated)
          return updated
        })
        toast.success('Case updated successfully!')
      } else {
        // Save new case
        setSavedCases(prev => {
          const updated = [encryptedCaseData, ...prev]
          console.log('📝 New cases list:', updated)
          return updated
        })
        toast.success('Case saved successfully!')
      }
      
      setShowSaveDialog(false)
      setNewFileName('')
      setSelectedFileToOverwrite('')
    } catch (error) {
      console.error('Error saving case:', error)
      toast.error('Failed to save case')
      hipaaCompliance.logAuditEntry('case_save_failed', caseData, {
        dataType: 'conversation',
        severity: 'high',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [])

  // Load a saved case
  const loadCase = useCallback(async (
    caseId: string,
    setMessages: (messages: Message[]) => void,
    setMedicalExtraction: (extraction: any) => void,
    setConversationSummary: (summary: any) => void
  ) => {
    console.log('📂 Loading case with ID:', caseId)
    console.log('📂 Available cases:', savedCases)
    const caseToLoad = savedCases.find(case_ => case_.id === caseId)
    if (caseToLoad) {
      console.log('📂 Found case to load:', caseToLoad)
      
      try {
        // Decrypt medical data if it's encrypted
        let decryptedData = caseToLoad
        if (caseToLoad.encrypted && caseToLoad.encryptedData) {
          const decryptionResult = await medicalEncryption.decryptMedicalData(caseToLoad.encryptedData)
          if (!decryptionResult.success) {
            console.error('Failed to decrypt case data:', decryptionResult.error)
            toast.error('Failed to decrypt case data')
            return
          }
          decryptedData = decryptionResult.data
        }
        
        // Convert timestamp strings back to Date objects for messages
        const messagesWithDates = decryptedData.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
        
        setMessages(messagesWithDates)
        setMedicalExtraction(decryptedData.medicalExtraction)
        setConversationSummary(decryptedData.conversationSummary)
        setShowLoadDialog(false)
        setSelectedFileToLoad('')
        
        // Log the load operation for audit
        hipaaCompliance.logAuditEntry('case_loaded', decryptedData, {
          dataType: 'conversation',
          severity: 'low',
          details: { caseId, caseName: caseToLoad.name }
        })
        
        toast.success(`Loaded case: ${caseToLoad.name}`)
      } catch (error) {
        console.error('Error loading case:', error)
        toast.error('Failed to load case')
        hipaaCompliance.logAuditEntry('case_load_failed', null, {
          dataType: 'conversation',
          severity: 'high',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } else {
      console.error('❌ Case not found:', caseId)
      toast.error('Case not found!')
    }
  }, [savedCases])

  // Delete a saved case
  const deleteCase = useCallback((caseId: string) => {
    setSavedCases(prev => prev.filter(case_ => case_.id !== caseId))
    setShowDeleteDialog(false)
    setSelectedFileToDelete('')
    toast.success('Case deleted successfully!')
  }, [])

  return {
    savedCases,
    showSaveDialog,
    setShowSaveDialog,
    showLoadDialog,
    setShowLoadDialog,
    showDeleteDialog,
    setShowDeleteDialog,
    saveMode,
    setSaveMode,
    newFileName,
    setNewFileName,
    selectedFileToOverwrite,
    setSelectedFileToOverwrite,
    selectedFileToLoad,
    setSelectedFileToLoad,
    selectedFileToDelete,
    setSelectedFileToDelete,
    refreshSavedCases,
    saveCurrentCase,
    loadCase,
    deleteCase
  }
}
