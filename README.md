# Medical Translator - AI-Powered Medical Communication Platform

A comprehensive web-based medical translation and communication platform designed to facilitate seamless doctor-patient interactions across language barriers. This application provides real-time translation, medical analysis, and conversation management with AI assistance.

## Live Demo

**Access the application:** https://navid-moradimehr.github.io/medical-translator/

## Key Features

### Core Translation Capabilities
- **Real-time Speech Recognition**: Convert spoken words to text in multiple languages
- **Bidirectional Translation**: Translate between any language pair using multiple AI providers
- **Text-to-Speech**: Hear translated text spoken in the target language
- **Manual Text Input**: Type messages directly when speech recognition is unavailable

### AI-Powered Medical Analysis
- **Live Medical Summary**: Automatic extraction and display of medical information during conversations
- **Medical Data Categorization**: Organizes information into:
  - Patient Background
  - Current Situation
  - Ongoing Care
  - Assessment & Plan
- **Symptom Detection**: Identifies and categorizes patient symptoms
- **Medication Tracking**: Extracts and lists mentioned medications
- **Pain Level Assessment**: Quantifies patient-reported pain levels
- **Severity Classification**: Categorizes medical situations by urgency
- **Treatment Recommendations**: Provides AI-generated medical recommendations

### Role-Based Interface
- **Doctor Mode**: Optimized interface for healthcare providers
- **Patient Mode**: Simplified interface for patients
- **Automatic Language Switching**: Languages automatically swap when switching roles
- **Context-Aware AI**: AI responses adapt based on the selected role

### Conversation Management
- **Save Conversations**: Store complete conversation sessions locally
- **Load Previous Cases**: Retrieve and continue previous medical consultations
- **Delete Cases**: Remove outdated or completed cases
- **New Case Creation**: Start fresh conversations with clean slate
- **Conversation Summary**: Generate comprehensive summaries of entire consultations

### Advanced Settings & Configuration
- **Multiple AI Providers**: Support for OpenAI, Google, DeepL, and MyMemory
- **API Key Management**: Secure storage and management of API credentials
- **Provider-Specific Keys**: Separate API keys for different translation services
- **AI Mode Toggle**: Switch between basic translation and AI-enhanced features
- **Language Selection**: Choose from extensive language options

### HIPAA Compliance Features
- **Data Encryption**: All medical data encrypted using AES-256-GCM
- **Local Storage**: Sensitive data stored locally, not transmitted unnecessarily
- **Audit Logging**: Track data access and modifications
- **Privacy Controls**: Configurable privacy settings for data handling
- **Consent Management**: User consent tracking for data processing
- **Breach Detection**: Monitoring for potential data security issues

### Accessibility Features
- **Screen Reader Support**: Full compatibility with assistive technologies
- **Keyboard Navigation**: Complete keyboard accessibility
- **High Contrast Mode**: Enhanced visibility options
- **Voice Announcements**: Audio feedback for important actions
- **Skip Links**: Quick navigation for keyboard users

## How to Use

### Getting Started
1. **Access the Application**: Open the web application in your browser
2. **Configure Settings**: Click the settings icon to configure your preferred translation provider and API keys
3. **Select Languages**: Choose the languages for "speak in" and "translate to"
4. **Choose Role**: Select either Doctor or Patient mode based on your role

### Basic Translation Workflow
1. **Start Recording**: Click the microphone button to begin speech recognition
2. **Speak Clearly**: Talk in your selected language
3. **Review Text**: Check the transcribed text appears correctly
4. **Translate**: The text automatically translates to the target language
5. **Listen**: Use the speaker button to hear the translation
6. **Continue Conversation**: Repeat the process for ongoing dialogue

### Using AI Features
1. **Enable AI Mode**: Toggle AI mode in the main interface
2. **Monitor Medical Summary**: Watch the live medical summary update as you speak
3. **Review Recommendations**: Check AI-generated medical recommendations
4. **Track Symptoms**: Monitor automatically detected symptoms and medications

### Managing Conversations
1. **Save Current Case**: Use the hamburger menu to save the current conversation
2. **Load Previous Case**: Retrieve a saved conversation to continue
3. **Generate Summary**: Create a comprehensive summary of the consultation
4. **Start New Case**: Begin a fresh conversation when needed

### Advanced Features
1. **Manual Text Input**: Type messages directly when speech recognition fails
2. **Medical Summary Modal**: View detailed medical analysis in a separate window
3. **Conversation Summary**: Generate end-of-session summaries
4. **API Key Management**: Add and manage multiple API keys for different providers

## Technical Requirements

### Browser Compatibility
- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

### Required Permissions
- Microphone access for speech recognition
- Local storage for saving conversations and settings

### Internet Connection
- Required for translation services and AI features
- Works offline for saved conversations and basic interface

## Security & Privacy

### Data Protection
- All medical data encrypted locally
- API keys stored securely using Web Crypto API
- No medical data transmitted to third parties unnecessarily
- Local storage only - no cloud storage of sensitive information

### HIPAA Compliance
- Audit logging of all data access
- Configurable privacy settings
- Consent management for data processing
- Breach detection and monitoring
- Data retention controls

## Support & Troubleshooting

### Common Issues
- **Speech Recognition Not Working**: Check microphone permissions and browser compatibility
- **Translation Errors**: Verify API keys are correctly configured
- **AI Features Unavailable**: Ensure AI mode is enabled and API keys are valid
- **Saved Cases Not Loading**: Check browser storage permissions

### Performance Optimization
- Close unnecessary browser tabs
- Ensure stable internet connection
- Use supported browsers for best performance
- Clear browser cache if experiencing issues

## Development & Customization

### Technology Stack
- React 19 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Framer Motion for animations
- Web Speech API for speech recognition
- Multiple AI translation providers

### Modular Architecture
- Component-based design for easy maintenance
- Custom hooks for reusable logic
- TypeScript for type safety
- Responsive design for all devices

## License & Usage

This application is designed for medical professionals and healthcare organizations. Please ensure compliance with local medical regulations and data protection laws when using this tool in clinical settings.

For technical support or feature requests, please contact the development team.
