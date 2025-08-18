// Medical information extraction utilities
interface MedicalExtraction {
  // Legacy fields for backward compatibility
  painLevel: number // 1-10 scale
  symptoms: string[]
  medications: string[]
  medicalHistory: {
    conditions: string[]
    surgeries: string[]
    allergies: string[]
    familyHistory: string[]
    lifestyle: string[]
  }
  vitalSigns: {
    bloodPressure?: string
    temperature?: string
    heartRate?: string
    weight?: string
    height?: string
  }
  diagnosis: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  recommendations: string[]
  urgency: 'routine' | 'urgent' | 'emergency'
  confidence: number // 0-1

  // New AI-powered intelligent categorization (all optional with defaults)
  patientBackground?: {
    currentMedications: string[]
    allergies: string[]
    pastMedicalHistory: string[]
    familyHistory: string[]
    lifestyle: string[]
    chronicConditions: string[]
  }
  currentSituation?: {
    chiefComplaint: string
    presentingSymptoms: string[]
    acuteIssues: string[]
    recentChanges: string[]
    painLevel: number
    symptomDuration: string
  }
  ongoingCare?: {
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
  assessmentAndPlan?: {
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
}

// Helper function to get safe defaults for optional fields
export function getMedicalExtractionDefaults(): Required<Pick<MedicalExtraction, 'patientBackground' | 'currentSituation' | 'ongoingCare' | 'assessmentAndPlan'>> {
  return {
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
      severity: 'low',
      urgency: 'routine'
    }
  }
}

// Medical patterns for extraction
const MEDICAL_PATTERNS = {
  pain: {
    keywords: [
      'pain', 'ache', 'hurt', 'sore', 'tender', 'burning', 'stabbing', 'throbbing',
      'sharp', 'dull', 'cramping', 'aching', 'discomfort', 'sensitivity'
    ],
    locations: [
      'head', 'headache', 'migraine', 'neck', 'back', 'shoulder', 'arm', 'leg',
      'chest', 'stomach', 'abdomen', 'hip', 'knee', 'ankle', 'foot', 'hand',
      'throat', 'ear', 'eye', 'tooth', 'jaw'
    ],
    intensity: [
      'mild', 'moderate', 'severe', 'excruciating', 'unbearable', 'intense',
      'slight', 'minor', 'major', 'extreme'
    ]
  },
  symptoms: {
    general: [
      'fever', 'chills', 'fatigue', 'weakness', 'dizziness', 'nausea', 'vomiting',
      'diarrhea', 'constipation', 'loss of appetite', 'weight loss', 'weight gain'
    ],
    respiratory: [
      'cough', 'sneeze', 'runny nose', 'congestion', 'shortness of breath',
      'wheezing', 'chest tightness', 'difficulty breathing'
    ],
    cardiovascular: [
      'chest pain', 'palpitations', 'irregular heartbeat', 'high blood pressure',
      'low blood pressure', 'swelling', 'edema'
    ],
    neurological: [
      'headache', 'migraine', 'seizure', 'numbness', 'tingling', 'paralysis',
      'memory loss', 'confusion', 'dizziness', 'vertigo'
    ],
    gastrointestinal: [
      'stomach pain', 'abdominal pain', 'heartburn', 'acid reflux', 'bloating',
      'gas', 'indigestion', 'ulcer', 'colitis'
    ]
  },
  medications: {
    patterns: [
      /(?:taking|on|using|prescribed|medication|medicine|drug|pill|tablet|capsule|injection|cream|ointment)\s+([a-zA-Z\s-]+)/gi,
      /(?:mg|mcg|g|ml|units?)\s+([a-zA-Z\s-]+)/gi,
      /([a-zA-Z\s-]+)\s+(?:mg|mcg|g|ml|units?)/gi
    ]
  },
  medicalHistory: {
    conditions: {
      diabetes: ['diabetes', 'diabetic', 'blood sugar', 'insulin', 'type 1', 'type 2'],
      cardiovascular: ['heart', 'cardiac', 'hypertension', 'high blood pressure', 'heart attack', 'stroke', 'arrhythmia'],
      musculoskeletal: ['arthritis', 'joint pain', 'bone', 'fracture', 'sprain', 'strain', 'osteoporosis'],
      respiratory: ['asthma', 'copd', 'bronchitis', 'pneumonia', 'lung', 'breathing'],
      gastrointestinal: ['ulcer', 'colitis', 'crohn', 'ibs', 'acid reflux', 'gerd'],
      neurological: ['epilepsy', 'seizure', 'migraine', 'stroke', 'alzheimer', 'parkinson']
    }
  }
}

class MedicalExtractionService {
  // Extract pain level from text (1-10 scale)
  static extractPainLevel(text: string): number {
    const lowerText = text.toLowerCase()
    
    // Direct pain level mentions
    const painLevelMatch = lowerText.match(/(?:pain level|pain scale|hurts|pain)\s*(?:is\s*)?(\d+)(?:\s*out\s*of\s*10|\/10)?/i)
    if (painLevelMatch) {
      const level = parseInt(painLevelMatch[1])
      return Math.min(Math.max(level, 1), 10)
    }
    
    // Infer from intensity words
    const intensityWords = {
      'mild': 2, 'slight': 2, 'minor': 2,
      'moderate': 5, 'medium': 5,
      'severe': 8, 'intense': 8, 'major': 8,
      'excruciating': 10, 'unbearable': 10, 'extreme': 10
    }
    
    for (const [word, level] of Object.entries(intensityWords)) {
      if (lowerText.includes(word)) {
        return level
      }
    }
    
    // Default pain level if mentioned but no specific level
    if (MEDICAL_PATTERNS.pain.keywords.some(keyword => lowerText.includes(keyword))) {
      return 5 // Moderate pain as default
    }
    
    return 0 // No pain mentioned
  }

  // Extract symptoms from text
  static extractSymptoms(text: string): string[] {
    const lowerText = text.toLowerCase()
    const symptoms: string[] = []
    
    // Check all symptom categories
    Object.values(MEDICAL_PATTERNS.symptoms).forEach(category => {
      category.forEach(symptom => {
        if (lowerText.includes(symptom)) {
          symptoms.push(symptom)
        }
      })
    })
    
    return [...new Set(symptoms)] // Remove duplicates
  }

  // Extract medications from text
  static extractMedications(text: string): string[] {
    const medications: string[] = []
    
    // Use regex patterns to find medications
    MEDICAL_PATTERNS.medications.patterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const medication = match.replace(/(?:taking|on|using|prescribed|medication|medicine|drug|pill|tablet|capsule|injection|cream|ointment)\s+/gi, '')
            .replace(/\s+(?:mg|mcg|g|ml|units?)/gi, '')
            .trim()
          if (medication && medication.length > 2) {
            medications.push(medication)
          }
        })
      }
    })
    
    return [...new Set(medications)]
  }

  // Extract medical history from text
  static extractMedicalHistory(text: string): MedicalExtraction['medicalHistory'] {
    const lowerText = text.toLowerCase()
    const history = {
      conditions: [] as string[],
      surgeries: [] as string[],
      allergies: [] as string[],
      familyHistory: [] as string[],
      lifestyle: [] as string[]
    }
    
    // Check each condition category and add to conditions array
    Object.entries(MEDICAL_PATTERNS.medicalHistory.conditions).forEach(([condition, keywords]) => {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        history.conditions.push(condition)
      }
    })
    
    return history
  }

  // Determine severity level
  static determineSeverity(painLevel: number, symptoms: string[]): 'low' | 'medium' | 'high' {
    if (painLevel >= 8 || symptoms.length >= 5) return 'high'
    if (painLevel >= 5 || symptoms.length >= 3) return 'medium'
    return 'low'
  }

  // Generate recommendations based on extracted information
  static generateRecommendations(extraction: MedicalExtraction): string[] {
    const recommendations: string[] = []
    
    if (extraction.painLevel >= 8) {
      recommendations.push('Consider immediate medical attention for severe pain')
    }
    
    if (extraction.symptoms.includes('chest pain') || extraction.symptoms.includes('shortness of breath')) {
      recommendations.push('Chest pain and breathing difficulties require urgent evaluation')
    }
    
    if (extraction.medicalHistory.conditions.includes('diabetes')) {
      recommendations.push('Monitor blood glucose levels closely')
    }
    
    if (extraction.medicalHistory.conditions.includes('cardiovascular')) {
      recommendations.push('Continue cardiovascular medications as prescribed')
    }
    
    if (extraction.symptoms.includes('fever') && extraction.symptoms.includes('cough')) {
      recommendations.push('Consider COVID-19 testing if symptoms persist')
    }
    
    return recommendations
  }

  // Main extraction function
  static extractMedicalInfo(text: string): MedicalExtraction {
    const painLevel = this.extractPainLevel(text)
    const symptoms = this.extractSymptoms(text)
    const medications = this.extractMedications(text)
    const medicalHistory = this.extractMedicalHistory(text)
    const severity = this.determineSeverity(painLevel, symptoms)
    const recommendations = this.generateRecommendations({ 
      painLevel, 
      symptoms, 
      medications, 
      medicalHistory, 
      severity, 
      confidence: 0, 
      recommendations: [],
      vitalSigns: {},
      diagnosis: [],
      urgency: 'routine'
    })
    
    // Calculate confidence based on extraction quality
    const confidence = Math.min(
      (symptoms.length * 0.1 + medications.length * 0.15 + painLevel * 0.05 + medicalHistory.conditions.length * 0.2),
      1
    )
    
    return {
      painLevel,
      symptoms,
      medications,
      medicalHistory,
      vitalSigns: {},
      diagnosis: [],
      severity,
      recommendations,
      urgency: 'routine',
      confidence: Math.round(confidence * 100) / 100
    }
  }

  // Extract from conversation
  static extractFromConversation(messages: Array<{ text: string; isDoctor: boolean }>): MedicalExtraction {
    const allText = messages.map(msg => msg.text).join(' ')
    const extraction = this.extractMedicalInfo(allText)
    
    // Enhance with conversation context
    const patientMessages = messages.filter(msg => !msg.isDoctor)
    const doctorMessages = messages.filter(msg => msg.isDoctor)
    
    // If doctor asked specific questions, enhance extraction
    if (doctorMessages.some(msg => msg.text.toLowerCase().includes('pain'))) {
      extraction.confidence = Math.min(extraction.confidence + 0.1, 1)
    }
    
    return extraction
  }
}

export { MedicalExtractionService }
export type { MedicalExtraction }
export default MedicalExtractionService
