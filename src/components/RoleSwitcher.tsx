import { motion } from 'framer-motion'
import { User } from 'lucide-react'
import { getAccessibilityProps, handleKeyboardNavigation } from '../utils/accessibility'

interface RoleSwitcherProps {
  isDoctor: boolean
  switchRole: (isDoctor: boolean) => void
}

export const RoleSwitcher = ({ isDoctor, switchRole }: RoleSwitcherProps) => {
  return (
    <div className="flex items-center justify-center mb-6 sm:mb-8">
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-2 border border-white/20">
        <div className="flex items-center space-x-1 sm:space-x-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => switchRole(true)}
            onKeyDown={(e) => handleKeyboardNavigation(e, () => switchRole(true))}
            {...getAccessibilityProps('role-switch', { isDoctor: true })}
            className={`flex items-center space-x-2 sm:space-x-3 px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 text-sm sm:text-base ${
              isDoctor 
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-medium">Doctor</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => switchRole(false)}
            onKeyDown={(e) => handleKeyboardNavigation(e, () => switchRole(false))}
            {...getAccessibilityProps('role-switch', { isDoctor: false })}
            className={`flex items-center space-x-2 sm:space-x-3 px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 text-sm sm:text-base ${
              !isDoctor 
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-medium">Patient</span>
          </motion.button>
        </div>
      </div>
    </div>
  )
}
