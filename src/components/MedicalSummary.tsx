import type { MedicalExtraction } from '../utils/medicalExtraction'

interface MedicalSummaryProps {
  extraction: MedicalExtraction
  aiStatus: 'active' | 'inactive' | 'checking'
}

export const MedicalSummary = ({ extraction, aiStatus }: MedicalSummaryProps) => {
  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Medical Summary</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            extraction.severity === 'high' ? 'bg-red-400' :
            extraction.severity === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
          }`}></div>
          <span className="text-xs text-white/60 capitalize">{extraction.severity} severity</span>
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
      {extraction.painLevel > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white">Pain Level</h4>
          <div className="flex items-center space-x-3">
            <div className="flex-1 bg-white/10 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  extraction.painLevel <= 3 ? 'bg-green-400' :
                  extraction.painLevel <= 6 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${(extraction.painLevel / 10) * 100}%` }}
              ></div>
            </div>
            <span className="text-sm text-white font-medium">{extraction.painLevel}/10</span>
          </div>
        </div>
      )}
      
      {/* Symptoms */}
      {extraction.symptoms.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white">Symptoms</h4>
          <div className="flex flex-wrap gap-2">
            {extraction.symptoms.map((symptom, index) => (
              <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-200 text-xs rounded-full border border-blue-400/30">
                {symptom}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Medications */}
      {extraction.medications.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white">Medications</h4>
          <div className="flex flex-wrap gap-2">
            {extraction.medications.map((medication, index) => (
              <span key={index} className="px-2 py-1 bg-purple-500/20 text-purple-200 text-xs rounded-full border border-purple-400/30">
                {medication}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Medical History */}
      {(extraction.medicalHistory.conditions.length > 0 || 
        extraction.medicalHistory.surgeries.length > 0 || 
        extraction.medicalHistory.allergies.length > 0 || 
        extraction.medicalHistory.familyHistory.length > 0 || 
        extraction.medicalHistory.lifestyle.length > 0) && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white">Medical History</h4>
          <div className="space-y-2 text-xs">
            {extraction.medicalHistory.conditions.length > 0 && (
              <div>
                <span className="text-white/60">Conditions:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {extraction.medicalHistory.conditions.map((condition, index) => (
                    <span key={index} className="px-2 py-1 bg-red-500/20 text-red-200 rounded-full border border-red-400/30">
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {extraction.medicalHistory.surgeries.length > 0 && (
              <div>
                <span className="text-white/60">Surgeries:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {extraction.medicalHistory.surgeries.map((surgery, index) => (
                    <span key={index} className="px-2 py-1 bg-orange-500/20 text-orange-200 rounded-full border border-orange-400/30">
                      {surgery}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {extraction.medicalHistory.allergies.length > 0 && (
              <div>
                <span className="text-white/60">Allergies:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {extraction.medicalHistory.allergies.map((allergy, index) => (
                    <span key={index} className="px-2 py-1 bg-yellow-500/20 text-yellow-200 rounded-full border border-yellow-400/30">
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {extraction.medicalHistory.familyHistory.length > 0 && (
              <div>
                <span className="text-white/60">Family History:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {extraction.medicalHistory.familyHistory.map((history, index) => (
                    <span key={index} className="px-2 py-1 bg-indigo-500/20 text-indigo-200 rounded-full border border-indigo-400/30">
                      {history}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {extraction.medicalHistory.lifestyle.length > 0 && (
              <div>
                <span className="text-white/60">Lifestyle:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {extraction.medicalHistory.lifestyle.map((lifestyle, index) => (
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
      {(extraction.vitalSigns.bloodPressure || 
        extraction.vitalSigns.temperature || 
        extraction.vitalSigns.heartRate || 
        extraction.vitalSigns.weight || 
        extraction.vitalSigns.height) && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white">Vital Signs</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {extraction.vitalSigns.bloodPressure && (
              <div className="bg-white/5 rounded p-2">
                <span className="text-white/60">BP:</span> {extraction.vitalSigns.bloodPressure}
              </div>
            )}
            {extraction.vitalSigns.temperature && (
              <div className="bg-white/5 rounded p-2">
                <span className="text-white/60">Temp:</span> {extraction.vitalSigns.temperature}
              </div>
            )}
            {extraction.vitalSigns.heartRate && (
              <div className="bg-white/5 rounded p-2">
                <span className="text-white/60">HR:</span> {extraction.vitalSigns.heartRate}
              </div>
            )}
            {extraction.vitalSigns.weight && (
              <div className="bg-white/5 rounded p-2">
                <span className="text-white/60">Weight:</span> {extraction.vitalSigns.weight}
              </div>
            )}
            {extraction.vitalSigns.height && (
              <div className="bg-white/5 rounded p-2">
                <span className="text-white/60">Height:</span> {extraction.vitalSigns.height}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Diagnosis */}
      {extraction.diagnosis.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white">Diagnosis</h4>
          <div className="flex flex-wrap gap-2">
            {extraction.diagnosis.map((diagnosis, index) => (
              <span key={index} className="px-2 py-1 bg-green-500/20 text-green-200 text-xs rounded-full border border-green-400/30">
                {diagnosis}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Recommendations */}
      {extraction.recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white">Recommendations</h4>
          <div className="space-y-1">
            {extraction.recommendations.map((recommendation, index) => (
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
          extraction.confidence >= 0.7 ? 'text-green-400' :
          extraction.confidence >= 0.4 ? 'text-yellow-400' : 'text-red-400'
        }`}>
          {Math.round(extraction.confidence * 100)}%
        </span>
      </div>
    </div>
  )
}
