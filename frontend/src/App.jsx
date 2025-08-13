import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import OnboardingPage from './pages/Onboarding/OnboardingPage.jsx'
import DashboardLayout from './pages/Dashboard/DashboardLayout.jsx'
import DashboardHome from './pages/Dashboard/DashboardHome.jsx'
import CallsPage from './pages/Dashboard/CallsPage.jsx'
import CalendarPage from './pages/Dashboard/CalendarPage.jsx'
import ConfigurationPage from './pages/Dashboard/Configuration/ConfigurationPage.jsx'
import ScriptStudioPage from './pages/Dashboard/ScriptStudioPage.jsx'
import IntegrationsPage from './pages/Dashboard/IntegrationsPage.jsx'
import BillingPage from './pages/Dashboard/BillingPage.jsx'
import SettingsPage from './pages/Dashboard/SettingsPage.jsx'
import PricingPage from './pages/PricingPage.jsx'
import TermsOfServicePage from './pages/Legal/TermsOfServicePage.jsx'
import PrivacyPolicyPage from './pages/Legal/PrivacyPolicyPage.jsx'

export default function App() {
  console.log('App: Rendering main App component')
  
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        
        {/* Protected routes */}
        <Route path="/onboarding/*" element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        } />
        <Route path="/app" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>        
          <Route index element={<DashboardHome />} />
          <Route path="calls" element={<CallsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="configuration/*" element={<ConfigurationPage />} />
          <Route path="scripts" element={<ScriptStudioPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}


