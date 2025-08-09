import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import GoogleLoginButton from '../../components/auth/GoogleLoginButton'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { register } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Client-side validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const result = await register({
        email: formData.email,
        organizationName: formData.organizationName
        // Note: In production, you'd send the password too
      })
      
      if (result.success) {
        // Redirect to onboarding or dashboard
        navigate('/onboarding')
      } else {
        setError(result.error || 'Registration failed')
      }
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const isFormValid = formData.email && 
                     formData.password && 
                     formData.confirmPassword && 
                     formData.organizationName &&
                     formData.password === formData.confirmPassword

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              InfiniOffice
            </h1>
          </Link>
          <p className="text-muted-foreground mt-2">Create your account</p>
        </div>

        {/* Registration Form */}
        <div className="glass-strong rounded-xl p-8 border border-primary/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="organizationName" className="block text-sm font-medium mb-2">
                Business Name
              </label>
              <Input
                id="organizationName"
                name="organizationName"
                type="text"
                value={formData.organizationName}
                onChange={handleChange}
                placeholder="Your Business Name"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@business.com"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                disabled={loading}
                minLength="6"
              />
              <p className="text-xs text-muted-foreground mt-1">
                At least 6 characters
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !isFormValid}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-border"></div>
            <div className="px-3 text-sm text-muted-foreground">or</div>
            <div className="flex-1 border-t border-border"></div>
          </div>

          <GoogleLoginButton 
            onSuccess={() => navigate('/onboarding')}
            onError={(error) => setError(error.message)}
          />

          <div className="mt-6">
            <div className="text-xs text-muted-foreground mb-4">
              By creating an account, you agree to our{' '}
              <Link to="/terms" className="text-primary hover:text-primary/80">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-primary hover:text-primary/80">
                Privacy Policy
              </Link>
              .
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link 
                to="/auth/login" 
                className="text-primary hover:text-primary/80 font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center">
            <Link 
              to="/" 
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}