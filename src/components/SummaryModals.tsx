import { motion, AnimatePresence } from 'framer-motion'
import { X, Stethoscope, MessageSquare } from 'lucide-react'
import type { MedicalExtraction } from '../utils/medicalExtraction'

interface MedicalSummaryModalProps {
  showMedicalSummaryModal: boolean
  setShowMedicalSummaryModal: (show: boolean) => void
  medicalExtraction: MedicalExtraction | null
  aiStatus: 'active' | 'inactive' | 'checking'
}

interface ConversationSummaryModalProps {
  summary: any
  onClose: () => void
}

export const MedicalSummaryModal = ({
  showMedicalSummaryModal,
  setShowMedicalSummaryModal,
  medicalExtraction,
  aiStatus
}: MedicalSummaryModalProps) => {
  if (!medicalExtraction) return null

  return (
    <AnimatePresence>
      {showMedicalSummaryModal && (
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
            onClick={() => setShowMedicalSummaryModal(false)}
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                <Stethoscope className="w-6 h-6" />
                <span>Medical Summary</span>
              </h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowMedicalSummaryModal(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </motion.button>
            </div>

            <div className="p-6">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Medical Summary</h3>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      medicalExtraction.severity === 'high' ? 'bg-red-400' :
                      medicalExtraction.severity === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                    }`}></div>
                    <span className="text-xs text-white/60 capitalize">{medicalExtraction.severity} severity</span>
                    <div className="flex items-center space-x-1 ml-2">
                      <div className={`w-2 h-2 rounded-full ${
                        aiStatus === 'active' ? 'bg-green-400' : 'bg-gray-400'
                      }`}></div>
                      <span className="text-xs text-white/60">
                        {aiStatus === 'active' ? 'AI' : 'Pattern'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Pain Level */}
                {medicalExtraction.painLevel > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white">Pain Level</h4>
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 bg-white/10 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            medicalExtraction.painLevel <= 3 ? 'bg-green-400' :
                            medicalExtraction.painLevel <= 6 ? 'bg-yellow-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${(medicalExtraction.painLevel / 10) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-white font-medium">{medicalExtraction.painLevel}/10</span>
                    </div>
                  </div>
                )}
                
                {/* Symptoms */}
                {medicalExtraction.symptoms.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white">Symptoms</h4>
                    <div className="flex flex-wrap gap-2">
                      {medicalExtraction.symptoms.map((symptom, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-200 text-xs rounded-full border border-blue-400/30">
                          {symptom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Medications */}
                {medicalExtraction.medications.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white">Medications</h4>
                    <div className="flex flex-wrap gap-2">
                      {medicalExtraction.medications.map((medication, index) => (
                        <span key={index} className="px-2 py-1 bg-purple-500/20 text-purple-200 text-xs rounded-full border border-purple-400/30">
                          {medication}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Medical History */}
                {(medicalExtraction.medicalHistory.conditions.length > 0 || 
                  medicalExtraction.medicalHistory.surgeries.length > 0 || 
                  medicalExtraction.medicalHistory.allergies.length > 0 || 
                  medicalExtraction.medicalHistory.familyHistory.length > 0 || 
                  medicalExtraction.medicalHistory.lifestyle.length > 0) && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white">Medical History</h4>
                    <div className="space-y-2 text-xs">
                      {medicalExtraction.medicalHistory.conditions.length > 0 && (
                        <div>
                          <span className="text-white/60">Conditions:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.medicalHistory.conditions.map((condition, index) => (
                              <span key={index} className="px-2 py-1 bg-red-500/20 text-red-200 rounded-full border border-red-400/30">
                                {condition}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.medicalHistory.surgeries.length > 0 && (
                        <div>
                          <span className="text-white/60">Surgeries:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.medicalHistory.surgeries.map((surgery, index) => (
                              <span key={index} className="px-2 py-1 bg-orange-500/20 text-orange-200 rounded-full border border-orange-400/30">
                                {surgery}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.medicalHistory.allergies.length > 0 && (
                        <div>
                          <span className="text-white/60">Allergies:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.medicalHistory.allergies.map((allergy, index) => (
                              <span key={index} className="px-2 py-1 bg-yellow-500/20 text-yellow-200 rounded-full border border-yellow-400/30">
                                {allergy}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.medicalHistory.familyHistory.length > 0 && (
                        <div>
                          <span className="text-white/60">Family History:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.medicalHistory.familyHistory.map((history, index) => (
                              <span key={index} className="px-2 py-1 bg-indigo-500/20 text-indigo-200 rounded-full border border-indigo-400/30">
                                {history}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {medicalExtraction.medicalHistory.lifestyle.length > 0 && (
                        <div>
                          <span className="text-white/60">Lifestyle:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {medicalExtraction.medicalHistory.lifestyle.map((lifestyle, index) => (
                              <span key={index} className="px-2 py-1 bg-teal-500/20 text-teal-200 rounded-full border border-teal-400/30">
                                {lifestyle}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Vital Signs */}
                {(medicalExtraction.vitalSigns.bloodPressure || 
                  medicalExtraction.vitalSigns.temperature || 
                  medicalExtraction.vitalSigns.heartRate || 
                  medicalExtraction.vitalSigns.weight || 
                  medicalExtraction.vitalSigns.height) && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white">Vital Signs</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {medicalExtraction.vitalSigns.bloodPressure && (
                        <div className="bg-white/5 rounded p-2">
                          <span className="text-white/60">BP:</span> {medicalExtraction.vitalSigns.bloodPressure}
                        </div>
                      )}
                      {medicalExtraction.vitalSigns.temperature && (
                        <div className="bg-white/5 rounded p-2">
                          <span className="text-white/60">Temp:</span> {medicalExtraction.vitalSigns.temperature}
                        </div>
                      )}
                      {medicalExtraction.vitalSigns.heartRate && (
                        <div className="bg-white/5 rounded p-2">
                          <span className="text-white/60">HR:</span> {medicalExtraction.vitalSigns.heartRate}
                        </div>
                      )}
                      {medicalExtraction.vitalSigns.weight && (
                        <div className="bg-white/5 rounded p-2">
                          <span className="text-white/60">Weight:</span> {medicalExtraction.vitalSigns.weight}
                        </div>
                      )}
                      {medicalExtraction.vitalSigns.height && (
                        <div className="bg-white/5 rounded p-2">
                          <span className="text-white/60">Height:</span> {medicalExtraction.vitalSigns.height}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Diagnosis */}
                {medicalExtraction.diagnosis.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white">Diagnosis</h4>
                    <div className="flex flex-wrap gap-2">
                      {medicalExtraction.diagnosis.map((diagnosis, index) => (
                        <span key={index} className="px-2 py-1 bg-green-500/20 text-green-200 text-xs rounded-full border border-green-400/30">
                          {diagnosis}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Recommendations */}
                {medicalExtraction.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white">Recommendations</h4>
                    <div className="space-y-1">
                      {medicalExtraction.recommendations.map((recommendation, index) => (
                        <div key={index} className="text-xs text-white/90 flex items-start space-x-2">
                          <span className="text-blue-400 mt-1">•</span>
                          <span>{recommendation}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Confidence Score */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-xs text-white/60">Confidence:</span>
                  <span className={`text-sm font-medium ${
                    medicalExtraction.confidence >= 0.7 ? 'text-green-400' :
                    medicalExtraction.confidence >= 0.4 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {Math.round(medicalExtraction.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const ConversationSummaryModal = ({
  summary,
  onClose
}: ConversationSummaryModalProps) => {
  if (!summary) return null

  return (
    <AnimatePresence>
      {summary && (
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
          onClick={onClose}
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl"
        >
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <MessageSquare className="w-6 h-6" />
              <span>Conversation Summary</span>
            </h2>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </motion.button>
          </div>

          <div className="p-6">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 space-y-4">
              {/* Key Points */}
              {summary.keyPoints && summary.keyPoints.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white">Key Points</h3>
                  <div className="space-y-1">
                    {summary.keyPoints.map((point: string, index: number) => (
                      <div key={index} className="text-sm text-white/90 flex items-start space-x-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Medical Findings */}
              {summary.medicalFindings && summary.medicalFindings.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white">Medical Findings</h3>
                  <div className="space-y-1">
                    {summary.medicalFindings.map((finding: string, index: number) => (
                      <div key={index} className="text-sm text-white/90 flex items-start space-x-2">
                        <span className="text-green-400 mt-1">•</span>
                        <span>{finding}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {summary.recommendations && summary.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white">Recommendations</h3>
                  <div className="space-y-1">
                    {summary.recommendations.map((recommendation: string, index: number) => (
                      <div key={index} className="text-sm text-white/90 flex items-start space-x-2">
                        <span className="text-purple-400 mt-1">•</span>
                        <span>{recommendation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Steps */}
              {summary.nextSteps && summary.nextSteps.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white">Next Steps</h3>
                  <div className="space-y-1">
                    {summary.nextSteps.map((step: string, index: number) => (
                      <div key={index} className="text-sm text-white/90 flex items-start space-x-2">
                        <span className="text-yellow-400 mt-1">•</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Urgency and Confidence */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-white/60">Urgency:</span>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                    summary.urgency === 'emergency' ? 'bg-red-500/20 text-red-300' :
                    summary.urgency === 'urgent' ? 'bg-orange-500/20 text-orange-300' :
                    'bg-green-500/20 text-green-300'
                  }`}>
                    {summary.urgency}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-white/60">Confidence:</span>
                  <span className={`text-sm font-medium ${
                    summary.confidence >= 0.7 ? 'text-green-400' :
                    summary.confidence >= 0.4 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {Math.round(summary.confidence * 100)}%
                  </span>
                </div>
              </div>

              {/* Last Updated */}
              {summary.lastUpdated && (
                <div className="text-xs text-white/50 text-center">
                  Last updated: {new Date(summary.lastUpdated).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  )
}
