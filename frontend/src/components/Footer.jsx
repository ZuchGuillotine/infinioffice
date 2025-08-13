import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-white border-t">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              InfiniOffice
            </span>
            <span className="text-sm text-muted-foreground">
              © 2025 InfiniOffice LLC. All rights reserved.
            </span>
          </div>
          
          <div className="flex items-center space-x-6">
            <Link 
              to="/privacy" 
              className="text-sm text-muted-foreground hover:text-gray-900 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link 
              to="/terms" 
              className="text-sm text-muted-foreground hover:text-gray-900 transition-colors"
            >
              Terms of Service
            </Link>
            <a 
              href="mailto:delicacybydesign@gmail.com" 
              className="text-sm text-muted-foreground hover:text-gray-900 transition-colors"
            >
              Contact Us
            </a>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-muted-foreground text-center">
            InfiniOffice provides AI-powered voice assistance for businesses. 
            By using our service, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </footer>
  )
}