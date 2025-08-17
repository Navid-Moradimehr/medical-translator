import React from 'react'

// Accessibility utilities for medical translator app
// Handles ARIA labels, keyboard navigation, and screen reader support

export interface AccessibilityProps {
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-pressed'?: boolean
  'aria-expanded'?: boolean
  'aria-live'?: 'polite' | 'assertive' | 'off'
  'role'?: string
  tabIndex?: number
}

// Keyboard shortcuts for the app
export const KEYBOARD_SHORTCUTS = {
  SPACE: 'Toggle recording',
  ENTER: 'Send message',
  ESCAPE: 'Close modals',
  'Ctrl+S': 'Save conversation',
  'Ctrl+E': 'Export conversation',
  'Tab': 'Navigate between elements'
} as const

// Language names for screen readers
export const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'es': 'Spanish',
  'pt': 'Portuguese',
  'fa': 'Persian',
  'ar': 'Arabic',
  'zh': 'Chinese'
}

// Role names for screen readers
export const ROLE_NAMES: Record<string, string> = {
  'doctor': 'Doctor',
  'patient': 'Patient'
}

// Generate ARIA labels for common components
export function getAriaLabel(component: string, props?: Record<string, any>): string {
  switch (component) {
    case 'microphone':
      return props?.isRecording 
        ? 'Stop recording speech' 
        : 'Start recording speech'
    
    case 'language-selector':
      return `Select target language. Current language: ${LANGUAGE_NAMES[props?.currentLanguage || 'en']}`
    
    case 'role-switch':
      return `Switch to ${props?.isDoctor ? 'patient' : 'doctor'} mode`
    
    case 'settings':
      return 'Open settings menu'
    
    case 'clear-conversation':
      return 'Clear all conversation messages'
    
    case 'manual-input':
      return 'Enter text manually for translation'
    
    case 'send-button':
      return 'Send message for translation'
    
    case 'volume':
      return 'Play translated text as audio'
    
    default:
      return ''
  }
}

// Generate accessibility props for components
export function getAccessibilityProps(component: string, props?: Record<string, any>): AccessibilityProps {
  switch (component) {
    case 'microphone':
      return {
        'aria-label': getAriaLabel('microphone', props),
        'aria-pressed': props?.isRecording || false,
        'role': 'button',
        tabIndex: 0
      }
    
    case 'language-selector':
      return {
        'aria-label': getAriaLabel('language-selector', props),
        'aria-describedby': 'language-help',
        'role': 'combobox',
        tabIndex: 0
      }
    
    case 'role-switch':
      return {
        'aria-label': getAriaLabel('role-switch', props),
        'aria-pressed': props?.isDoctor || false,
        'role': 'button',
        tabIndex: 0
      }
    
    case 'settings':
      return {
        'aria-label': getAriaLabel('settings'),
        'aria-expanded': props?.showSettings || false,
        'role': 'button',
        tabIndex: 0
      }
    
    case 'clear-conversation':
      return {
        'aria-label': getAriaLabel('clear-conversation'),
        'role': 'button',
        tabIndex: 0
      }
    
    case 'manual-input':
      return {
        'aria-label': getAriaLabel('manual-input'),
        'aria-describedby': 'manual-input-help',
        'role': 'textbox',
        tabIndex: 0
      }
    
    case 'send-button':
      return {
        'aria-label': getAriaLabel('send-button'),
        'role': 'button',
        tabIndex: 0
      }
    
    case 'volume':
      return {
        'aria-label': getAriaLabel('volume'),
        'role': 'button',
        tabIndex: 0
      }
    
    default:
      return {}
  }
}

// Screen reader announcements
export class ScreenReader {
  private static announcementElement: HTMLElement | null = null

  static initialize() {
    if (!this.announcementElement) {
      this.announcementElement = document.createElement('div')
      this.announcementElement.setAttribute('aria-live', 'polite')
      this.announcementElement.setAttribute('aria-atomic', 'true')
      this.announcementElement.style.position = 'absolute'
      this.announcementElement.style.left = '-10000px'
      this.announcementElement.style.width = '1px'
      this.announcementElement.style.height = '1px'
      this.announcementElement.style.overflow = 'hidden'
      document.body.appendChild(this.announcementElement)
    }
  }

  static announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    this.initialize()
    
    if (this.announcementElement) {
      this.announcementElement.setAttribute('aria-live', priority)
      this.announcementElement.textContent = message
      
      // Clear the message after a short delay
      setTimeout(() => {
        if (this.announcementElement) {
          this.announcementElement.textContent = ''
        }
      }, 1000)
    }
  }

  static announceTranslation(originalText: string, translatedText: string, language: string) {
    const languageName = LANGUAGE_NAMES[language] || language
    this.announce(`Translation: ${translatedText} in ${languageName}`)
  }

  static announceRecordingStatus(isRecording: boolean, language: string) {
    const languageName = LANGUAGE_NAMES[language] || language
    const status = isRecording ? 'started' : 'stopped'
    this.announce(`Recording ${status} in ${languageName}`)
  }

  static announceRoleSwitch(isDoctor: boolean) {
    const role = isDoctor ? 'doctor' : 'patient'
    this.announce(`Switched to ${role} mode`)
  }
}

// Keyboard navigation handler
export function handleKeyboardNavigation(
  event: React.KeyboardEvent,
  action: () => void,
  allowedKeys: string[] = ['Enter', ' ']
) {
  if (allowedKeys.includes(event.key)) {
    event.preventDefault()
    action()
  }
}

// Focus management
export function focusFirstInteractiveElement(containerRef: React.RefObject<HTMLElement>) {
  if (containerRef.current) {
    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    
    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus()
    }
  }
}

// Skip link for keyboard users
export function createSkipLink(targetId: string, text: string = 'Skip to main content'): JSX.Element {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded z-50"
      onClick={(e: React.MouseEvent) => {
        e.preventDefault()
        const target = document.getElementById(targetId)
        if (target) {
          target.focus()
          target.scrollIntoView()
        }
      }}
    >
      {text}
    </a>
  )
}

// High contrast mode support
export function getHighContrastStyles() {
  return {
    backgroundColor: 'var(--high-contrast-bg, #000000)',
    color: 'var(--high-contrast-text, #ffffff)',
    borderColor: 'var(--high-contrast-border, #ffffff)'
  }
}

// Reduced motion support
export function getReducedMotionStyles() {
  return {
    transition: 'none',
    animation: 'none'
  }
}
