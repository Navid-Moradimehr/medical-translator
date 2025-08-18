// Translation Service for Medical Translator
// Handles multiple translation providers with fallback mechanisms

export interface TranslationRequest {
  text: string
  sourceLanguage: string
  targetLanguage: string
  context: 'medical' | 'general'
  provider: 'openai' | 'google' | 'deepl' | 'mymemory'
  apiKey?: string
}

export interface TranslationResponse {
  translatedText: string
  confidence: number
  provider: string
  medicalTerms: string[]
  error?: string
}

export interface TranslationProvider {
  name: string
  translate(request: TranslationRequest): Promise<TranslationResponse>
  isAvailable(): boolean
}

// OpenAI Translation Provider
class OpenAIProvider implements TranslationProvider {
  name = 'OpenAI GPT-3.5'
  private apiKey: string | null = null

  initialize(apiKey: string): void {
    this.apiKey = apiKey
  }

  isAvailable(): boolean {
    return this.apiKey !== null
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    try {
      const systemPrompt = `You are a medical translation expert. Translate the following text from ${request.sourceLanguage} to ${request.targetLanguage}.

Context: ${request.context} conversation
Requirements:
1. Preserve medical terminology accurately
2. Maintain the original meaning and tone
3. Provide confidence score (0-100)
4. Identify medical terms in the text

Format your response as:
Translation: [translated text]
Confidence: [0-100]
Medical Terms: [comma-separated medical terms]`

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
              content: request.text
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      const aiResponse = data.choices[0]?.message?.content || ''

      // Parse AI response
      const translationMatch = aiResponse.match(/Translation:\s*(.+?)(?:\n|$)/i)
      const confidenceMatch = aiResponse.match(/Confidence:\s*(\d+)/i)
      const medicalTermsMatch = aiResponse.match(/Medical Terms:\s*(.+?)(?:\n|$)/i)

      return {
        translatedText: translationMatch?.[1]?.trim() || request.text,
        confidence: confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.8,
        provider: this.name,
        medicalTerms: medicalTermsMatch?.[1]?.split(',').map((t: string) => t.trim()) || []
      }
    } catch (error) {
      throw new Error(`OpenAI translation failed: ${error}`)
    }
  }
}

// Google Translate Provider
class GoogleProvider implements TranslationProvider {
  name = 'Google Translate'
  private apiKey: string | null = null

  initialize(apiKey: string): void {
    this.apiKey = apiKey
  }

  isAvailable(): boolean {
    return this.apiKey !== null
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    if (!this.apiKey) {
      throw new Error('Google API key not configured')
    }

    try {
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: request.text,
            source: request.sourceLanguage,
            target: request.targetLanguage,
            format: 'text'
          })
        }
      )

      if (!response.ok) {
        throw new Error(`Google API error: ${response.status}`)
      }

      const data = await response.json()
      const translation = data.data.translations[0]?.translatedText || request.text

      return {
        translatedText: translation,
        confidence: 0.85, // Google doesn't provide confidence scores
        provider: this.name,
        medicalTerms: this.extractMedicalTerms(request.text)
      }
    } catch (error) {
      throw new Error(`Google translation failed: ${error}`)
    }
  }

  private extractMedicalTerms(text: string): string[] {
    // Simple medical term extraction
    const medicalTerms = [
      'pain', 'fever', 'headache', 'nausea', 'vomiting', 'diarrhea', 'cough',
      'sore throat', 'chest pain', 'shortness of breath', 'dizziness',
      'medication', 'prescription', 'symptoms', 'diagnosis', 'treatment'
    ]
    
    return medicalTerms.filter(term => 
      text.toLowerCase().includes(term.toLowerCase())
    )
  }
}

// DeepL Provider
class DeepLProvider implements TranslationProvider {
  name = 'DeepL'
  private apiKey: string | null = null

  initialize(apiKey: string): void {
    this.apiKey = apiKey
  }

  isAvailable(): boolean {
    return this.apiKey !== null
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    if (!this.apiKey) {
      throw new Error('DeepL API key not configured')
    }

    try {
      const response = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`
        },
        body: new URLSearchParams({
          text: request.text,
          source_lang: request.sourceLanguage.toUpperCase(),
          target_lang: request.targetLanguage.toUpperCase(),
          preserve_formatting: '1'
        })
      })

      if (!response.ok) {
        throw new Error(`DeepL API error: ${response.status}`)
      }

      const data = await response.json()
      const translation = data.translations[0]?.text || request.text

      return {
        translatedText: translation,
        confidence: 0.9, // DeepL is known for high quality
        provider: this.name,
        medicalTerms: this.extractMedicalTerms(request.text)
      }
    } catch (error) {
      throw new Error(`DeepL translation failed: ${error}`)
    }
  }

  private extractMedicalTerms(text: string): string[] {
    // Same medical term extraction as Google
    const medicalTerms = [
      'pain', 'fever', 'headache', 'nausea', 'vomiting', 'diarrhea', 'cough',
      'sore throat', 'chest pain', 'shortness of breath', 'dizziness',
      'medication', 'prescription', 'symptoms', 'diagnosis', 'treatment'
    ]
    
    return medicalTerms.filter(term => 
      text.toLowerCase().includes(term.toLowerCase())
    )
  }
}

// MyMemory Provider (Free)
class MyMemoryProvider implements TranslationProvider {
  name = 'MyMemory (Free)'
  private requestCount = 0
  private readonly MAX_REQUESTS = 100 // Daily limit

  isAvailable(): boolean {
    return this.requestCount < this.MAX_REQUESTS
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    if (!this.isAvailable()) {
      throw new Error('MyMemory daily limit reached')
    }

    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(request.text)}&langpair=${request.sourceLanguage}|${request.targetLanguage}`
      )

      if (!response.ok) {
        throw new Error(`MyMemory API error: ${response.status}`)
      }

      const data = await response.json()
      const translation = data.responseData?.translatedText || request.text
      const confidence = data.responseData?.match || 0.7

      this.requestCount++

      return {
        translatedText: translation,
        confidence: confidence,
        provider: this.name,
        medicalTerms: this.extractMedicalTerms(request.text)
      }
    } catch (error) {
      throw new Error(`MyMemory translation failed: ${error}`)
    }
  }

  private extractMedicalTerms(text: string): string[] {
    // Same medical term extraction
    const medicalTerms = [
      'pain', 'fever', 'headache', 'nausea', 'vomiting', 'diarrhea', 'cough',
      'sore throat', 'chest pain', 'shortness of breath', 'dizziness',
      'medication', 'prescription', 'symptoms', 'diagnosis', 'treatment'
    ]
    
    return medicalTerms.filter(term => 
      text.toLowerCase().includes(term.toLowerCase())
    )
  }
}

// Main Translation Service
class TranslationService {
  private static instance: TranslationService
  private providers: Map<string, TranslationProvider> = new Map()
  private apiKeys: Map<string, string> = new Map()

  private constructor() {
    // Initialize providers
    this.providers.set('openai', new OpenAIProvider())
    this.providers.set('google', new GoogleProvider())
    this.providers.set('deepl', new DeepLProvider())
    this.providers.set('mymemory', new MyMemoryProvider())
  }

  static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService()
    }
    return TranslationService.instance
  }

  // Set API key for a provider
  setApiKey(provider: string, apiKey: string): void {
    this.apiKeys.set(provider, apiKey)
    
    const providerInstance = this.providers.get(provider)
    if (providerInstance && 'initialize' in providerInstance) {
      (providerInstance as any).initialize(apiKey)
    }
  }

  // Get available providers
  getAvailableProviders(): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, provider]) => provider.isAvailable())
      .map(([name, _]) => name)
  }

  // Translate with fallback
  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const preferredProvider = this.providers.get(request.provider)
    
    if (preferredProvider && preferredProvider.isAvailable()) {
      try {
        return await preferredProvider.translate(request)
      } catch (error) {
        console.warn(`Preferred provider ${request.provider} failed:`, error)
      }
    }

    // Try fallback providers
    const fallbackOrder = ['openai', 'google', 'deepl', 'mymemory']
    const availableProviders = fallbackOrder.filter(provider => 
      provider !== request.provider && this.providers.get(provider)?.isAvailable()
    )

    for (const providerName of availableProviders) {
      try {
        const provider = this.providers.get(providerName)!
        const result = await provider.translate({
          ...request,
          provider: providerName as any
        })
        console.log(`Used fallback provider: ${providerName}`)
        return result
      } catch (error) {
        console.warn(`Fallback provider ${providerName} failed:`, error)
        continue
      }
    }

    // If all providers fail, return original text
    return {
      translatedText: request.text,
      confidence: 0,
      provider: 'none',
      medicalTerms: [],
      error: 'All translation providers failed'
    }
  }

  // Batch translate multiple texts
  async batchTranslate(requests: TranslationRequest[]): Promise<TranslationResponse[]> {
    const results: TranslationResponse[] = []
    
    for (const request of requests) {
      try {
        const result = await this.translate(request)
        results.push(result)
      } catch (error) {
        results.push({
          translatedText: request.text,
          confidence: 0,
          provider: 'none',
          medicalTerms: [],
          error: `Translation failed: ${error}`
        })
      }
    }
    
    return results
  }

  // Get provider status
  getProviderStatus(): Record<string, { available: boolean; name: string }> {
    const status: Record<string, { available: boolean; name: string }> = {}
    
    for (const [key, provider] of this.providers.entries()) {
      status[key] = {
        available: provider.isAvailable(),
        name: provider.name
      }
    }
    
    return status
  }
}

export default TranslationService
