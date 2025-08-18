// AI Service for Medical Translator
// Handles real-time conversation analysis, translation, and medical information extraction

export interface AITranslationRequest {
  text: string
  sourceLanguage: string
  targetLanguage: string
  context: 'medical' | 'general'
  role: 'doctor' | 'patient'
}

export interface AITranslationResponse {
  translatedText: string
  confidence: number
  medicalTerms: string[]
  context: string
  suggestions: string[]
}

export interface AIMedicalAnalysis {
  patientBackground: {
    currentMedications: string[]
    allergies: string[]
    pastMedicalHistory: string[]
    familyHistory: string[]
    lifestyle: string[]
    chronicConditions: string[]
  }
  currentSituation: {
    chiefComplaint: string
    presentingSymptoms: string[]
    acuteIssues: string[]
    recentChanges: string[]
    painLevel: number
    symptomDuration: string
  }
  ongoingCare: {
    activeTreatments: string[]
    medications: string[]
    recentDiagnoses: string[]
    monitoring: string[]
    vitalSigns: {
      bloodPressure?: string
      temperature?: string
      heartRate?: string
      weight?: string
      height?: string
    }
  }
  assessmentAndPlan: {
    diagnosis: string[]
    differentialDiagnosis: string[]
    treatmentPlan: string[]
    medicationsPrescribed: string[]
    recommendations: string[]
    followUp: string[]
    patientInstructions: string[]
    severity: 'low' | 'medium' | 'high' | 'critical'
    urgency: 'routine' | 'urgent' | 'emergency'
  }
  confidence: number
  lastUpdated: string
}

export interface ConversationSummary {
  keyPoints: string[]
  medicalFindings: string[]
  recommendations: string[]
  urgency: 'routine' | 'urgent' | 'emergency'
  nextSteps: string[]
  confidence: number
}

class AIService {
  private static instance: AIService
  private apiKey: string | null = null
  private isOnline: boolean = true
  private lastAnalysis: AIMedicalAnalysis | null = null
  private conversationHistory: Array<{ text: string; role: 'doctor' | 'patient'; timestamp: string }> = []

  private constructor() {}

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService()
    }
    return AIService.instance
  }

  // Initialize AI service with API key
  initialize(apiKey: string): void {
    this.apiKey = apiKey
    this.isOnline = true
  }

  // Check if AI service is available
  isAvailable(): boolean {
    return this.isOnline && this.apiKey !== null
  }

  // Add message to conversation history
  addToConversation(text: string, role: 'doctor' | 'patient'): void {
    this.conversationHistory.push({
      text,
      role,
      timestamp: new Date().toISOString()
    })
    
    // Keep only last 50 messages to prevent memory issues
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50)
    }
  }

  // AI-powered translation with medical context
  async translateWithAI(request: AITranslationRequest): Promise<AITranslationResponse> {
    if (!this.isAvailable()) {
      throw new Error('AI service not available')
    }

    try {
      const systemPrompt = this.buildMedicalTranslationPrompt(request.context, request.role)
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `Translate the following ${request.sourceLanguage} text to ${request.targetLanguage}:\n\n"${request.text}"\n\nProvide the translation and identify any medical terms.`
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      })

      if (!response.ok) {
        throw new Error(`AI translation failed: ${response.status}`)
      }

      const data = await response.json()
      const aiResponse = data.choices[0]?.message?.content || ''

      // Parse AI response
      const translationMatch = aiResponse.match(/Translation:\s*(.+?)(?:\n|$)/i)
      const medicalTermsMatch = aiResponse.match(/Medical Terms:\s*(.+?)(?:\n|$)/i)
      const confidenceMatch = aiResponse.match(/Confidence:\s*(\d+)/i)

      return {
        translatedText: translationMatch?.[1]?.trim() || request.text,
        confidence: confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.8,
        medicalTerms: medicalTermsMatch?.[1]?.split(',').map(t => t.trim()) || [],
        context: request.context,
        suggestions: this.extractSuggestions(aiResponse)
      }
    } catch (error) {
      console.error('AI translation error:', error)
      throw error
    }
  }

  // Real-time medical conversation analysis
  async analyzeConversation(): Promise<AIMedicalAnalysis> {
    if (!this.isAvailable()) {
      throw new Error('AI service not available')
    }

    try {
      const conversationText = this.conversationHistory
        .map(msg => `${msg.role}: ${msg.text}`)
        .join('\n')

      const systemPrompt = this.buildMedicalAnalysisPrompt()
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `Analyze this medical conversation and extract structured information:\n\n${conversationText}`
            }
          ],
          temperature: 0.2,
          max_tokens: 1500
        })
      })

      if (!response.ok) {
        throw new Error(`AI analysis failed: ${response.status}`)
      }

      const data = await response.json()
      const aiResponse = data.choices[0]?.message?.content || ''

      // Parse AI response into structured data
      const analysis = this.parseMedicalAnalysis(aiResponse)
      analysis.lastUpdated = new Date().toISOString()
      
      this.lastAnalysis = analysis
      return analysis
    } catch (error) {
      console.error('AI analysis error:', error)
      throw error
    }
  }

  // Generate conversation summary
  async generateSummary(): Promise<ConversationSummary> {
    if (!this.isAvailable()) {
      throw new Error('AI service not available')
    }

    try {
      const conversationText = this.conversationHistory
        .map(msg => `${msg.role}: ${msg.text}`)
        .join('\n')

      const systemPrompt = `You are a medical AI assistant. Generate a concise summary of the medical conversation including:
1. Key points discussed
2. Medical findings
3. Recommendations
4. Urgency level (routine/urgent/emergency)
5. Next steps

Format as JSON with keys: keyPoints, medicalFindings, recommendations, urgency, nextSteps, confidence`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `Summarize this medical conversation:\n\n${conversationText}`
            }
          ],
          temperature: 0.3,
          max_tokens: 800
        })
      })

      if (!response.ok) {
        throw new Error(`AI summary failed: ${response.status}`)
      }

      const data = await response.json()
      const aiResponse = data.choices[0]?.message?.content || ''

      // Try to parse JSON response
      try {
        const summary = JSON.parse(aiResponse)
        return {
          keyPoints: summary.keyPoints || [],
          medicalFindings: summary.medicalFindings || [],
          recommendations: summary.recommendations || [],
          urgency: summary.urgency || 'routine',
          nextSteps: summary.nextSteps || [],
          confidence: summary.confidence || 0.8
        }
      } catch {
        // Fallback parsing if JSON is malformed
        return this.parseSummaryFallback(aiResponse)
      }
    } catch (error) {
      console.error('AI summary error:', error)
      throw error
    }
  }

  // Get last analysis
  getLastAnalysis(): AIMedicalAnalysis | null {
    return this.lastAnalysis
  }

  // Clear conversation history
  clearConversation(): void {
    this.conversationHistory = []
    this.lastAnalysis = null
  }

  // Private helper methods
  private buildMedicalTranslationPrompt(context: 'medical' | 'general', role: 'doctor' | 'patient'): string {
    return `You are a medical translation AI specialized in ${context} conversations between doctors and patients.

Your task is to:
1. Translate the text accurately while preserving medical terminology
2. Identify and highlight medical terms
3. Provide confidence score (0-100)
4. Suggest alternative medical phrases if applicable

Context: ${context} conversation
Role: ${role}

Format your response as:
Translation: [translated text]
Medical Terms: [comma-separated medical terms]
Confidence: [0-100]
Suggestions: [alternative phrases]`
  }

  private buildMedicalAnalysisPrompt(): string {
    return `You are a medical AI assistant analyzing doctor-patient conversations.

Extract structured medical information in the following format:

Patient Background:
- Current Medications: [list]
- Allergies: [list]
- Past Medical History: [list]
- Family History: [list]
- Lifestyle: [list]
- Chronic Conditions: [list]

Current Situation:
- Chief Complaint: [text]
- Presenting Symptoms: [list]
- Acute Issues: [list]
- Recent Changes: [list]
- Pain Level: [0-10]
- Symptom Duration: [text]

Ongoing Care:
- Active Treatments: [list]
- Medications: [list]
- Recent Diagnoses: [list]
- Monitoring: [list]
- Vital Signs: [if mentioned]

Assessment & Plan:
- Diagnosis: [list]
- Differential Diagnosis: [list]
- Treatment Plan: [list]
- Medications Prescribed: [list]
- Recommendations: [list]
- Follow-up: [list]
- Patient Instructions: [list]
- Severity: [low/medium/high/critical]
- Urgency: [routine/urgent/emergency]

Confidence: [0-1]`
  }

  private parseMedicalAnalysis(aiResponse: string): AIMedicalAnalysis {
    // This is a simplified parser - in production, you'd want more robust parsing
    const defaults: AIMedicalAnalysis = {
      patientBackground: {
        currentMedications: [],
        allergies: [],
        pastMedicalHistory: [],
        familyHistory: [],
        lifestyle: [],
        chronicConditions: []
      },
      currentSituation: {
        chiefComplaint: '',
        presentingSymptoms: [],
        acuteIssues: [],
        recentChanges: [],
        painLevel: 0,
        symptomDuration: ''
      },
      ongoingCare: {
        activeTreatments: [],
        medications: [],
        recentDiagnoses: [],
        monitoring: [],
        vitalSigns: {}
      },
      assessmentAndPlan: {
        diagnosis: [],
        differentialDiagnosis: [],
        treatmentPlan: [],
        medicationsPrescribed: [],
        recommendations: [],
        followUp: [],
        patientInstructions: [],
        severity: 'low' as const,
        urgency: 'routine' as const
      },
      confidence: 0.7,
      lastUpdated: new Date().toISOString()
    }

    // Extract information using regex patterns
    const painLevelMatch = aiResponse.match(/Pain Level:\s*(\d+)/i)
    if (painLevelMatch) {
      defaults.currentSituation.painLevel = parseInt(painLevelMatch[1])
    }

    const confidenceMatch = aiResponse.match(/Confidence:\s*([\d.]+)/i)
    if (confidenceMatch) {
      defaults.confidence = parseFloat(confidenceMatch[1])
    }

    // Extract lists using regex
    const extractList = (text: string, pattern: RegExp): string[] => {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1].split(',').map(item => item.trim()).filter(item => item.length > 0)
      }
      return []
    }

    defaults.patientBackground.currentMedications = extractList(aiResponse, /Current Medications:\s*(.+?)(?:\n|$)/i)
    defaults.patientBackground.allergies = extractList(aiResponse, /Allergies:\s*(.+?)(?:\n|$)/i)
    defaults.currentSituation.presentingSymptoms = extractList(aiResponse, /Presenting Symptoms:\s*(.+?)(?:\n|$)/i)
    defaults.assessmentAndPlan.diagnosis = extractList(aiResponse, /Diagnosis:\s*(.+?)(?:\n|$)/i)
    defaults.assessmentAndPlan.recommendations = extractList(aiResponse, /Recommendations:\s*(.+?)(?:\n|$)/i)

    return defaults
  }

  private extractSuggestions(aiResponse: string): string[] {
    const suggestionsMatch = aiResponse.match(/Suggestions:\s*(.+?)(?:\n|$)/i)
    if (suggestionsMatch) {
      return suggestionsMatch[1].split(',').map(s => s.trim()).filter(s => s.length > 0)
    }
    return []
  }

  private parseSummaryFallback(aiResponse: string): ConversationSummary {
    // Fallback parsing if JSON parsing fails
    return {
      keyPoints: aiResponse.split('\n').filter(line => line.trim().length > 0).slice(0, 5),
      medicalFindings: [],
      recommendations: [],
      urgency: 'routine',
      nextSteps: [],
      confidence: 0.6
    }
  }
}

export default AIService
