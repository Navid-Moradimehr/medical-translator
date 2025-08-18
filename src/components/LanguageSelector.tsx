import { getAccessibilityProps } from '../utils/accessibility'

interface LanguageSelectorProps {
  sourceLanguage: string
  currentLanguage: string
  setSourceLanguage: (language: string) => void
  setCurrentLanguage: (language: string) => void
}

export const LanguageSelector = ({
  sourceLanguage,
  currentLanguage,
  setSourceLanguage,
  setCurrentLanguage
}: LanguageSelectorProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 lg:space-x-8 mb-6 sm:mb-8">
      {/* Source Language */}
      <div className="text-center w-full sm:w-auto">
        <label className="block text-xs sm:text-sm text-white/60 mb-2" id="source-language-label">Speak in:</label>
        <select
          value={sourceLanguage}
          onChange={(e) => setSourceLanguage(e.target.value)}
          aria-labelledby="source-language-label"
          aria-describedby="source-language-help"
          className="w-full max-w-[200px] sm:w-auto bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-3 sm:px-6 py-2 sm:py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
        >
          <option value="en-US" className="bg-gray-800 text-white">English (US)</option>
          <option value="es-ES" className="bg-gray-800 text-white">Spanish (España)</option>
          <option value="pt-BR" className="bg-gray-800 text-white">Portuguese (Brasil)</option>
          <option value="fa-IR" className="bg-gray-800 text-white">Persian (فارسی)</option>
          <option value="ar-SA" className="bg-gray-800 text-white">Arabic (العربية)</option>
          <option value="zh-CN" className="bg-gray-800 text-white">Chinese (中文)</option>
          <option value="fr-FR" className="bg-gray-800 text-white">French (Français)</option>
          <option value="de-DE" className="bg-gray-800 text-white">German (Deutsch)</option>
        </select>
      </div>

      {/* Target Language */}
      <div className="text-center w-full sm:w-auto">
        <label className="block text-xs sm:text-sm text-white/60 mb-2" id="target-language-label">Translate to:</label>
        <select
          value={currentLanguage}
          onChange={(e) => setCurrentLanguage(e.target.value)}
          aria-labelledby="target-language-label"
          aria-describedby="language-help"
          {...getAccessibilityProps('language-selector', { currentLanguage })}
          className="w-full max-w-[200px] sm:w-auto bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-3 sm:px-6 py-2 sm:py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
        >
          <option value="en" className="bg-gray-800 text-white">English</option>
          <option value="es" className="bg-gray-800 text-white">Spanish (Español)</option>
          <option value="pt" className="bg-gray-800 text-white">Portuguese (Português)</option>
          <option value="fa" className="bg-gray-800 text-white">Persian (فارسی)</option>
          <option value="ar" className="bg-gray-800 text-white">Arabic (العربية)</option>
          <option value="zh" className="bg-gray-800 text-white">Chinese (中文)</option>
          <option value="fr" className="bg-gray-800 text-white">French (Français)</option>
          <option value="de" className="bg-gray-800 text-white">German (Deutsch)</option>
        </select>
      </div>
    </div>
  )
}
