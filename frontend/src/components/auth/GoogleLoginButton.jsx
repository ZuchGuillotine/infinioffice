import { useState } from 'react'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'

export default function GoogleLoginButton({ onSuccess, onError, className = "" }) {
  const [loading, setLoading] = useState(false)
  const { googleLogin } = useAuth()

  const handleGoogleLogin = async () => {
    setLoading(true)
    
    try {
      // Load Google Identity Services script if not already loaded
      if (!window.google) {
        await loadGoogleIdentityScript()
      }

      // Initialize Google OAuth
      if (window.google?.accounts) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        })

        // Show Google One Tap dialog
        window.google.accounts.id.prompt()
      } else {
        throw new Error('Google Identity Services not available')
      }
    } catch (error) {
      setLoading(false)
      if (onError) onError(error)
      console.error('Google login initialization failed:', error)
    }
  }

  const handleCredentialResponse = async (response) => {
    try {
      const result = await googleLogin(response.credential)
      
      if (result.success) {
        if (onSuccess) onSuccess(result)
      } else {
        throw new Error(result.error || 'Google login failed')
      }
    } catch (error) {
      if (onError) onError(error)
      console.error('Google login failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadGoogleIdentityScript = () => {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="accounts.google.com"]')) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  return (
    <Button
      variant="outline"
      onClick={handleGoogleLogin}
      disabled={loading}
      className={`w-full flex items-center justify-center gap-3 ${className}`}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" />
          Signing in with Google...
        </>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18Z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01a4.8 4.8 0 0 1-2.7.75c-2.09 0-3.86-1.4-4.49-3.31H1.83v2.07A8 8 0 0 0 8.98 17Z"/>
            <path fill="#FBBC04" d="M4.49 10.49a4.77 4.77 0 0 1 0-3.09V5.33H1.83a8 8 0 0 0 0 7.24l2.66-2.08Z"/>
            <path fill="#EA4335" d="M8.98 4.72c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.33L4.5 7.4c.63-1.9 2.4-3.31 4.49-3.31Z"/>
          </svg>
          Continue with Google
        </>
      )}
    </Button>
  )
}