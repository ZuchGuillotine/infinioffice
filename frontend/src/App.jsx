import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/onboarding/*" element={<OnboardingPage />} />
      <Route path="/app" element={<DashboardLayout />}>        
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
  )
}


