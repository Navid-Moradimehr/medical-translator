# Medical Translator MVP

A React-based, AI-powered medical translation application for doctor-patient communication.

## Features

- **Speech Recognition**: Real-time voice-to-text using Web Speech API
- **Translation Services**: Multiple providers (MyMemory free, OpenAI, Google, DeepL)
- **Text-to-Speech**: Browser-based voice output
- **Multi-language Support**: English, Spanish, Portuguese, Persian, Arabic, Chinese
- **Role Switching**: Toggle between Doctor and Patient modes
- **Conversation History**: Real-time chat interface
- **Responsive Design**: Works on desktop and mobile
- **API Key Management**: Secure storage and management of translation API keys

## How to Use

### For Users:
1. Open the app in any browser
2. Grant microphone permission when prompted
3. Select source language (what you'll speak in)
4. Select target language (what you want to translate to)
5. Click microphone button and speak
6. Click microphone again to stop and see translation
7. Translation will be displayed and spoken back

### For Developers:
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Deploy to GitHub Pages
npm run deploy
```

## Translation Providers

- **MyMemory (Free)**: No API key required, 100 requests/day
- **OpenAI GPT-3.5**: Requires API key, best medical translation
- **Google Translate**: Requires API key, good general translation
- **DeepL**: Requires API key, excellent for European languages

## Technical Details

- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with glassmorphism design
- **Speech**: Web Speech API (built into browsers)
- **Translation**: Multiple cloud APIs with fallback
- **Storage**: Browser localStorage for API keys
- **Deployment**: Static hosting ready
