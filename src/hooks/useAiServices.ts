import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { hipaaCompliance } from '../utils/hipaa'
import { Message } from './useConversation'

export const useAiServices = () => {
  const [aiStatus, setAiStatus] = useState<'active' | 'inactive' | 'checking'>('checking')
  const [aiMode, setAiMode] = useState<'basic' | 'ai'>('basic')
  const [activeModel, setActiveModel] = useState<string>('')

  // Check AI availability
  const checkAiAvailability = useCallback(async (
    selectedProvider: string,
    selectedApiKey: string,
    apiKeys: Record<string, string>
  ) => {
    try {
      // Check if selected provider is a cloud model that supports AI
      const cloudProviders = ['openai', 'google', 'deepl']
      const isCloudProvider = cloudProviders.includes(selectedProvider)
      
      if (!isCloudProvider) {
        setAiStatus('inactive')
        return
      }
      
      // Check if API key exists for the selected provider
      const hasApiKey = selectedApiKey && apiKeys[selectedApiKey] && apiKeys[selectedApiKey].trim() !== ''
      
      if (hasApiKey) {
        setAiStatus('active')
      } else {
        setAiStatus('inactive')
      }
    } catch (error) {
      console.error('Error checking AI availability:', error)
      setAiStatus('inactive')
    }
  }, [])

  // Function to toggle AI mode
  const toggleAiMode = useCallback((
    autoSelectApiKey: () => boolean
  ) => {
    if (aiMode === 'basic') {
      // Switching to AI mode
      const hasApiKey = autoSelectApiKey()
      if (hasApiKey) {
        setAiMode('ai')
        setAiStatus('active')
        toast.success(`Switched to AI Mode - ${activeModel}`)
      } else {
        toast.error('No API keys available. Please add an API key in settings.')
      }
    } else {
      // Switching to basic mode
      setAiMode('basic')
      setAiStatus('inactive')
      setActiveModel('')
      toast.success('Switched to Basic Mode')
    }
  }, [aiMode, activeModel])

  // Real-time conversation summary with AI
  const generateConversationSummary = useCallback(async (
    messages: Message[],
    selectedApiKey: string,
    apiKeys: Record<string, string>,
    isDoctor: boolean,
    sourceLanguage: string,
    currentLanguage: string
  ) => {
    try {
      if (!selectedApiKey || !apiKeys[selectedApiKey]) {
        return null
      }

      const conversationText = messages.map(msg => `${msg.isDoctor ? 'Doctor' : 'Patient'}: ${msg.text}`).join('\n')

      // Detect doctor's language based on current role
      // When isDoctor=true: doctor's language is in sourceLanguage (speak in)
      // When isDoctor=false: doctor's language is in currentLanguage (translate to)
      const doctorLanguage = isDoctor ? sourceLanguage.split('-')[0] : currentLanguage
      const languageNames: Record<string, string> = {
        'en': 'English',
        'es': 'Spanish', 
        'pt': 'Portuguese',
        'fa': 'Persian',
        'ar': 'Arabic',
        'zh': 'Chinese',
        'fr': 'French',
        'de': 'German'
      }
      const doctorLanguageName = languageNames[doctorLanguage] || 'English'

      const summaryPrompt = `You are a medical AI assistant. Generate a concise, real-time summary of this medical conversation in ${doctorLanguageName} (doctor's language). Include:

1. **Key Points**: Main topics discussed (max 3 points)
2. **Medical Findings**: Clinical observations and symptoms mentioned (max 3 findings)
3. **Recommendations**: Medical advice or suggestions given (max 3 recommendations)
4. **Urgency Level**: routine/urgent/emergency based on symptoms and context
5. **Next Steps**: Immediate actions needed (max 3 steps)
6. **Confidence**: 0-1 score based on clarity and completeness

IMPORTANT: Always respond in ${doctorLanguageName}, regardless of the conversation language.

Format as JSON:
{
  "keyPoints": ["point1", "point2", "point3"],
  "medicalFindings": ["finding1", "finding2", "finding3"],
  "recommendations": ["rec1", "rec2", "rec3"],
  "urgency": "routine|urgent|emergency",
  "nextSteps": ["step1", "step2", "step3"],
  "confidence": 0.85
}

Conversation:
${conversationText}

Provide a focused, actionable summary for clinical decision-making in ${doctorLanguageName}.`

      // Log AI request for audit
      hipaaCompliance.logAuditEntry('ai_summary_request', { messageCount: messages.length, doctorLanguage }, {
        dataType: 'summary',
        severity: 'medium',
        details: { provider: 'openai', model: 'gpt-3.5-turbo' }
      })

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeys[selectedApiKey]}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a medical AI assistant specializing in real-time conversation analysis.' },
            { role: 'user', content: summaryPrompt }
          ],
          temperature: 0.2,
          max_tokens: 800
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('AI summary generation failed:', response.status, errorText)
        
        // Log AI failure for audit
        hipaaCompliance.logAuditEntry('ai_summary_failed', null, {
          dataType: 'summary',
          severity: 'high',
          success: false,
          errorMessage: `HTTP ${response.status}: ${errorText}`
        })
        
        throw new Error(`AI summary generation failed: ${response.status}`)
      }

      const data = await response.json()
      const aiResponse = data.choices[0].message.content.trim()
      
      // Parse AI response
      const summary = JSON.parse(aiResponse)
      
      const result = {
        keyPoints: summary.keyPoints || [],
        medicalFindings: summary.medicalFindings || [],
        recommendations: summary.recommendations || [],
        urgency: summary.urgency || 'routine',
        nextSteps: summary.nextSteps || [],
        confidence: summary.confidence || 0.7,
        lastUpdated: new Date()
      }

      // Log successful AI response for audit
      hipaaCompliance.logAuditEntry('ai_summary_success', result, {
        dataType: 'summary',
        severity: 'low',
        details: { urgency: result.urgency, confidence: result.confidence }
      })
      
      return result
    } catch (error) {
      console.error('AI conversation summary failed:', error)
      
      // Log AI error for audit
      hipaaCompliance.logAuditEntry('ai_summary_error', null, {
        dataType: 'summary',
        severity: 'high',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      })
      
      // Show user-friendly message about fallback
      if (aiStatus === 'active') {
        toast.error('AI summary generation failed, using basic features')
      }
      return null
    }
  }, [aiStatus])

  // AI-powered medical extraction
  const extractMedicalWithAI = useCallback(async (
    messages: Message[],
    selectedApiKey: string,
    apiKeys: Record<string, string>,
    isDoctor: boolean,
    sourceLanguage: string,
    currentLanguage: string
  ) => {
    try {
      const conversationText = messages.map(msg => `${msg.isDoctor ? 'Doctor' : 'Patient'}: ${msg.text}`).join('\n')

      // Detect doctor's language based on current role
      // When isDoctor=true: doctor's language is in sourceLanguage (speak in)
      // When isDoctor=false: doctor's language is in currentLanguage (translate to)
      const doctorLanguage = isDoctor ? sourceLanguage.split('-')[0] : currentLanguage
      const languageNames: Record<string, string> = {
        'en': 'English',
        'es': 'Spanish', 
        'pt': 'Portuguese',
        'fa': 'Persian',
        'ar': 'Arabic',
        'zh': 'Chinese',
        'fr': 'French',
        'de': 'German'
      }
      const doctorLanguageName = languageNames[doctorLanguage] || 'English'

      const systemPrompt = `You are an intelligent medical AI assistant that analyzes doctor-patient conversations in real-time. Your role is to:

1. **Intelligently categorize medical information** based on content, not conversation stage
2. **Separate patient background** from current situation and ongoing care
3. **Update information dynamically** as new details emerge
4. **Provide context-appropriate summaries** for doctors in ${doctorLanguageName}

**IMPORTANT: Always respond in ${doctorLanguageName}, regardless of the conversation language.**

**Information Categorization Rules:**
- **Patient Background**: Historical information (past conditions, surgeries, family history, chronic medications, allergies, lifestyle habits)
- **Current Situation**: Presenting symptoms, current complaints, recent changes, acute issues
- **Ongoing Care**: Current treatments, medications being taken, recent diagnoses, active monitoring
- **Assessment & Plan**: Doctor's findings, diagnoses, treatment plans, recommendations, follow-up

**Smart Analysis Approach:**
- Analyze the NATURE of information, not when it was mentioned
- Update categories as new information emerges
- Maintain comprehensive tracking across all categories
- Provide real-time insights for clinical decision making in ${doctorLanguageName}`

      const analysisPrompt = `Analyze this medical conversation and provide a comprehensive, intelligently categorized medical summary in ${doctorLanguageName}:

{
  "patientBackground": {
    "currentMedications": ["medications patient is currently taking regularly"],
    "allergies": ["known allergies and reactions"],
    "pastMedicalHistory": ["significant past illnesses, surgeries, chronic conditions"],
    "familyHistory": ["relevant family medical history"],
    "lifestyle": ["smoking, alcohol, exercise, diet, occupation"],
    "chronicConditions": ["ongoing medical conditions"]
  },
  "currentSituation": {
    "chiefComplaint": "primary reason for current visit",
    "presentingSymptoms": ["current symptoms that brought patient in"],
    "acuteIssues": ["new or worsening problems"],
    "recentChanges": ["recent changes in health status"],
    "painLevel": number (1-10 scale, 0 if no pain mentioned),
    "symptomDuration": "how long symptoms have been present"
  },
  "ongoingCare": {
    "activeTreatments": ["current treatments being received"],
    "medications": ["all medications discussed - current and new"],
    "recentDiagnoses": ["diagnoses made in recent visits"],
    "monitoring": ["conditions being monitored"],
    "vitalSigns": {
      "bloodPressure": "if mentioned",
      "temperature": "if mentioned", 
      "heartRate": "if mentioned",
      "weight": "if mentioned",
      "height": "if mentioned"
    }
  },
  "assessmentAndPlan": {
    "diagnosis": ["diagnoses made or suspected"],
    "differentialDiagnosis": ["conditions being considered"],
    "treatmentPlan": ["treatments prescribed or recommended"],
    "medicationsPrescribed": ["new medications prescribed"],
    "recommendations": ["medical recommendations made"],
    "followUp": ["follow-up appointments, tests, monitoring"],
    "patientInstructions": ["instructions given to patient"],
    "severity": "low" | "medium" | "high" | "critical",
    "urgency": "routine" | "urgent" | "emergency"
  },
  "confidence": number (0-1, based on clarity and completeness of information)
}

**Analysis Instructions:**
- Categorize information based on its NATURE, not when it was mentioned
- Patient background can be mentioned at any point in conversation
- Current symptoms can be discussed throughout the visit
- Update all categories as new information emerges
- Maintain comprehensive tracking across the entire conversation
- Focus on clinical relevance and decision-making support
- **IMPORTANT: Always respond in ${doctorLanguageName}, regardless of conversation language**

Conversation:
${conversationText}

Return a comprehensive JSON object with all medical information intelligently categorized in ${doctorLanguageName}.`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeys[selectedApiKey]}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: analysisPrompt }
          ],
          temperature: 0.1,
          max_tokens: 1500
        })
      })

      if (!response.ok) {
        throw new Error('AI extraction failed')
      }

      const data = await response.json()
      const aiResponse = data.choices[0].message.content.trim()
      
      // Parse AI response
      const extraction = JSON.parse(aiResponse)

      // Process intelligently categorized response
      const processedExtraction = {
        // Legacy fields for backward compatibility
        painLevel: Math.min(Math.max(extraction.currentSituation?.painLevel || extraction.painLevel || 0, 0), 10),
        symptoms: Array.isArray(extraction.currentSituation?.presentingSymptoms) ? extraction.currentSituation.presentingSymptoms : (Array.isArray(extraction.symptoms) ? extraction.symptoms : []),
        medications: Array.isArray(extraction.ongoingCare?.medications) ? extraction.ongoingCare.medications : (Array.isArray(extraction.medications) ? extraction.medications : []),
        medicalHistory: {
          conditions: Array.isArray(extraction.patientBackground?.chronicConditions) ? extraction.patientBackground.chronicConditions : (Array.isArray(extraction.medicalHistory?.conditions) ? extraction.medicalHistory.conditions : []),
          surgeries: Array.isArray(extraction.patientBackground?.pastMedicalHistory) ? extraction.patientBackground.pastMedicalHistory.filter((item: string) => item.toLowerCase().includes('surgery') || item.toLowerCase().includes('operation')) : (Array.isArray(extraction.medicalHistory?.surgeries) ? extraction.medicalHistory.surgeries : []),
          allergies: Array.isArray(extraction.patientBackground?.allergies) ? extraction.patientBackground.allergies : (Array.isArray(extraction.medicalHistory?.allergies) ? extraction.medicalHistory.allergies : []),
          familyHistory: Array.isArray(extraction.patientBackground?.familyHistory) ? extraction.patientBackground.familyHistory : (Array.isArray(extraction.medicalHistory?.familyHistory) ? extraction.medicalHistory.familyHistory : []),
          lifestyle: Array.isArray(extraction.patientBackground?.lifestyle) ? extraction.patientBackground.lifestyle : (Array.isArray(extraction.medicalHistory?.lifestyle) ? extraction.medicalHistory.lifestyle : [])
        },
        vitalSigns: {
          bloodPressure: extraction.ongoingCare?.vitalSigns?.bloodPressure || extraction.vitalSigns?.bloodPressure || undefined,
          temperature: extraction.ongoingCare?.vitalSigns?.temperature || extraction.vitalSigns?.temperature || undefined,
          heartRate: extraction.ongoingCare?.vitalSigns?.heartRate || extraction.vitalSigns?.heartRate || undefined,
          weight: extraction.ongoingCare?.vitalSigns?.weight || extraction.vitalSigns?.weight || undefined,
          height: extraction.ongoingCare?.vitalSigns?.height || extraction.vitalSigns?.height || undefined
        },
        diagnosis: Array.isArray(extraction.assessmentAndPlan?.diagnosis) ? extraction.assessmentAndPlan.diagnosis : (Array.isArray(extraction.diagnosis) ? extraction.diagnosis : []),
        severity: ['low', 'medium', 'high', 'critical'].includes(extraction.assessmentAndPlan?.severity) ? extraction.assessmentAndPlan.severity : (['low', 'medium', 'high', 'critical'].includes(extraction.severity) ? extraction.severity : 'low'),
        recommendations: Array.isArray(extraction.assessmentAndPlan?.recommendations) ? extraction.assessmentAndPlan.recommendations : (Array.isArray(extraction.recommendations) ? extraction.recommendations : []),
        urgency: ['routine', 'urgent', 'emergency'].includes(extraction.assessmentAndPlan?.urgency) ? extraction.assessmentAndPlan.urgency : (['routine', 'urgent', 'emergency'].includes(extraction.urgency) ? extraction.urgency : 'routine'),
        confidence: Math.min(Math.max(extraction.confidence || 0.5, 0), 1),

        // New AI-powered intelligent categorization
        patientBackground: {
          currentMedications: Array.isArray(extraction.patientBackground?.currentMedications) ? extraction.patientBackground.currentMedications : [],
          allergies: Array.isArray(extraction.patientBackground?.allergies) ? extraction.patientBackground.allergies : [],
          pastMedicalHistory: Array.isArray(extraction.patientBackground?.pastMedicalHistory) ? extraction.patientBackground.pastMedicalHistory : [],
          familyHistory: Array.isArray(extraction.patientBackground?.familyHistory) ? extraction.patientBackground.familyHistory : [],
          lifestyle: Array.isArray(extraction.patientBackground?.lifestyle) ? extraction.patientBackground.lifestyle : [],
          chronicConditions: Array.isArray(extraction.patientBackground?.chronicConditions) ? extraction.patientBackground.chronicConditions : []
        },
        currentSituation: {
          chiefComplaint: extraction.currentSituation?.chiefComplaint || '',
          presentingSymptoms: Array.isArray(extraction.currentSituation?.presentingSymptoms) ? extraction.currentSituation.presentingSymptoms : [],
          acuteIssues: Array.isArray(extraction.currentSituation?.acuteIssues) ? extraction.currentSituation.acuteIssues : [],
          recentChanges: Array.isArray(extraction.currentSituation?.recentChanges) ? extraction.currentSituation.recentChanges : [],
          painLevel: Math.min(Math.max(extraction.currentSituation?.painLevel || 0, 0), 10),
          symptomDuration: extraction.currentSituation?.symptomDuration || ''
        },
        ongoingCare: {
          activeTreatments: Array.isArray(extraction.ongoingCare?.activeTreatments) ? extraction.ongoingCare.activeTreatments : [],
          medications: Array.isArray(extraction.ongoingCare?.medications) ? extraction.ongoingCare.medications : [],
          recentDiagnoses: Array.isArray(extraction.ongoingCare?.recentDiagnoses) ? extraction.ongoingCare.recentDiagnoses : [],
          monitoring: Array.isArray(extraction.ongoingCare?.monitoring) ? extraction.ongoingCare.monitoring : [],
          vitalSigns: {
            bloodPressure: extraction.ongoingCare?.vitalSigns?.bloodPressure || undefined,
            temperature: extraction.ongoingCare?.vitalSigns?.temperature || undefined,
            heartRate: extraction.ongoingCare?.vitalSigns?.heartRate || undefined,
            weight: extraction.ongoingCare?.vitalSigns?.weight || undefined,
            height: extraction.ongoingCare?.vitalSigns?.height || undefined
          }
        },
        assessmentAndPlan: {
          diagnosis: Array.isArray(extraction.assessmentAndPlan?.diagnosis) ? extraction.assessmentAndPlan.diagnosis : [],
          differentialDiagnosis: Array.isArray(extraction.assessmentAndPlan?.differentialDiagnosis) ? extraction.assessmentAndPlan.differentialDiagnosis : [],
          treatmentPlan: Array.isArray(extraction.assessmentAndPlan?.treatmentPlan) ? extraction.assessmentAndPlan.treatmentPlan : [],
          medicationsPrescribed: Array.isArray(extraction.assessmentAndPlan?.medicationsPrescribed) ? extraction.assessmentAndPlan.medicationsPrescribed : [],
          recommendations: Array.isArray(extraction.assessmentAndPlan?.recommendations) ? extraction.assessmentAndPlan.recommendations : [],
          followUp: Array.isArray(extraction.assessmentAndPlan?.followUp) ? extraction.assessmentAndPlan.followUp : [],
          patientInstructions: Array.isArray(extraction.assessmentAndPlan?.patientInstructions) ? extraction.assessmentAndPlan.patientInstructions : [],
          severity: ['low', 'medium', 'high', 'critical'].includes(extraction.assessmentAndPlan?.severity) ? extraction.assessmentAndPlan.severity : 'low',
          urgency: ['routine', 'urgent', 'emergency'].includes(extraction.assessmentAndPlan?.urgency) ? extraction.assessmentAndPlan.urgency : 'routine'
        }
      }
      
      return processedExtraction
    } catch (error) {
      console.error('AI extraction failed, falling back to pattern-based extraction:', error)
      // Show user-friendly message about fallback
      if (aiStatus === 'active') {
        toast.error('AI medical analysis failed, using basic pattern detection')
      }
      return null
    }
  }, [aiStatus])

  return {
    aiStatus,
    setAiStatus,
    aiMode,
    setAiMode,
    activeModel,
    setActiveModel,
    checkAiAvailability,
    toggleAiMode,
    generateConversationSummary,
    extractMedicalWithAI
  }
}
