import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Brain, 
  Activity, 
  AlertTriangle, 
  Clock, 
  TrendingUp,
  Heart,
  Pill,
  Stethoscope,
  User,
  MessageSquare
} from 'lucide-react'
import AIService, { type AIMedicalAnalysis, type ConversationSummary } from '../utils/aiService'

interface ConversationAnalysisProps {
  messages: Array<{ text: string; isDoctor: boolean; timestamp: Date }>
  isVisible: boolean
  onToggle: () => void
  aiService: AIService
}

export default function ConversationAnalysis({ 
  messages, 
  isVisible, 
  onToggle, 
  aiService 
}: ConversationAnalysisProps) {
  const [analysis, setAnalysis] = useState<AIMedicalAnalysis | null>(null)
  const [summary, setSummary] = useState<ConversationSummary | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Auto-analyze conversation when messages change
  useEffect(() => {
    if (messages.length > 0 && aiService.isAvailable()) {
      const analyzeConversation = async () => {
        setIsAnalyzing(true)
        setError(null)
        
        try {
          // Add messages to AI service
          messages.forEach(msg => {
            aiService.addToConversation(msg.text, msg.isDoctor ? 'doctor' : 'patient')
          })

          // Get real-time analysis
          const newAnalysis = await aiService.analyzeConversation()
          setAnalysis(newAnalysis)
          setLastUpdate(new Date())

          // Generate summary every 5 messages
          if (messages.length % 5 === 0) {
            const newSummary = await aiService.generateSummary()
            setSummary(newSummary)
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Analysis failed')
          console.error('Conversation analysis error:', err)
        } finally {
          setIsAnalyzing(false)
        }
      }

      // Debounce analysis to avoid too many API calls
      const timeoutId = setTimeout(analyzeConversation, 2000)
      return () => clearTimeout(timeoutId)
    }
  }, [messages, aiService])

  if (!isVisible) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 right-4 w-80 bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 shadow-xl z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/20">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <h3 className="text-white font-medium">AI Analysis</h3>
          {isAnalyzing && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-white/60">Analyzing...</span>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="text-white/60 hover:text-white transition-colors"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {error && (
          <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-red-200 text-sm">Analysis Error</span>
            </div>
            <p className="text-red-200/80 text-xs mt-1">{error}</p>
          </div>
        )}

        {/* Real-time Summary */}
        {summary && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span className="text-white font-medium text-sm">Conversation Summary</span>
            </div>
            
            <div className="space-y-2">
              {summary.keyPoints.length > 0 && (
                <div>
                  <span className="text-white/80 text-xs">Key Points:</span>
                  <ul className="mt-1 space-y-1">
                    {summary.keyPoints.slice(0, 3).map((point, index) => (
                      <li key={index} className="text-white/60 text-xs flex items-start space-x-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.medicalFindings.length > 0 && (
                <div>
                  <span className="text-white/80 text-xs">Medical Findings:</span>
                  <ul className="mt-1 space-y-1">
                    {summary.medicalFindings.slice(0, 2).map((finding, index) => (
                      <li key={index} className="text-white/60 text-xs flex items-start space-x-2">
                        <span className="text-green-400 mt-1">•</span>
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-white/80 text-xs">Urgency:</span>
                  <div className={`w-2 h-2 rounded-full ${
                    summary.urgency === 'emergency' ? 'bg-red-400' :
                    summary.urgency === 'urgent' ? 'bg-orange-400' : 'bg-green-400'
                  }`}></div>
                  <span className="text-white/60 text-xs capitalize">{summary.urgency}</span>
                </div>
                <span className="text-white/40 text-xs">
                  {Math.round(summary.confidence * 100)}% confidence
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Medical Analysis */}
        {analysis && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Stethoscope className="w-4 h-4 text-green-400" />
              <span className="text-white font-medium text-sm">Medical Analysis</span>
            </div>

            {/* Current Situation */}
            {analysis.currentSituation.presentingSymptoms.length > 0 && (
              <div className="bg-green-500/10 border border-green-400/20 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <Activity className="w-4 h-4 text-green-400" />
                  <span className="text-green-200 text-xs font-medium">Current Symptoms</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {analysis.currentSituation.presentingSymptoms.slice(0, 4).map((symptom, index) => (
                    <span key={index} className="px-2 py-1 bg-green-500/20 text-green-200 rounded-full text-xs border border-green-400/30">
                      {symptom}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pain Level */}
            {analysis.currentSituation.painLevel > 0 && (
              <div className="bg-orange-500/10 border border-orange-400/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Heart className="w-4 h-4 text-orange-400" />
                    <span className="text-orange-200 text-xs font-medium">Pain Level</span>
                  </div>
                  <span className="text-orange-200 text-xs font-medium">
                    {analysis.currentSituation.painLevel}/10
                  </span>
                </div>
                <div className="w-full bg-orange-500/20 rounded-full h-2">
                  <div 
                    className="bg-orange-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(analysis.currentSituation.painLevel / 10) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Medications */}
            {analysis.ongoingCare.medications.length > 0 && (
              <div className="bg-purple-500/10 border border-purple-400/20 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <Pill className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-200 text-xs font-medium">Current Medications</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {analysis.ongoingCare.medications.slice(0, 3).map((medication, index) => (
                    <span key={index} className="px-2 py-1 bg-purple-500/20 text-purple-200 rounded-full text-xs border border-purple-400/30">
                      {medication}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Assessment */}
            {analysis.assessmentAndPlan.diagnosis.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-400/20 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-200 text-xs font-medium">Assessment</span>
                </div>
                <div className="space-y-1">
                  {analysis.assessmentAndPlan.diagnosis.slice(0, 2).map((diagnosis, index) => (
                    <div key={index} className="text-blue-200 text-xs flex items-start space-x-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>{diagnosis}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confidence and Last Update */}
            <div className="flex items-center justify-between text-xs text-white/40">
              <div className="flex items-center space-x-2">
                <span>Confidence: {Math.round(analysis.confidence * 100)}%</span>
              </div>
              {lastUpdate && (
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{lastUpdate.toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No Analysis Yet */}
        {!analysis && !isAnalyzing && !error && (
          <div className="text-center py-8">
            <Brain className="w-8 h-8 text-white/40 mx-auto mb-2" />
            <p className="text-white/60 text-sm">Start a conversation to see AI analysis</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
