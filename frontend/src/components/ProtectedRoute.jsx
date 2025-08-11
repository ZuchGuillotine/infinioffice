import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './ui/LoadingSpinner'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  console.log('ProtectedRoute: Rendering with:', {
    isAuthenticated,
    loading,
    pathname: location.pathname
  })

  if (loading) {
    console.log('ProtectedRoute: Showing loading state')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute: Not authenticated, redirecting to login')
    // Redirect to login page with return url
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  console.log('ProtectedRoute: Authenticated, rendering children')
  return children
}