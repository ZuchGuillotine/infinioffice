import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button.jsx'
import BusinessBasics from './steps/BusinessBasics.jsx'
import PhoneNumbers from './steps/PhoneNumbers.jsx'
import ScriptComposer from './steps/ScriptComposer.jsx'
import SchedulingRules from './steps/SchedulingRules.jsx'
import TestCall from './steps/TestCall.jsx'
import { createContext, useMemo, useState } from 'react'

export const OnboardingContext = createContext(null)

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [org, setOrg] = useState({ name: '', phone: '', timezone: 'America/New_York' })
  const ctx = useMemo(() => ({ org, setOrg }), [org])
  return (
    <OnboardingContext.Provider value={ctx}>
    <div className="min-h-screen container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <Link to="/"><span className="font-semibold">InfiniOffice</span></Link>
        <Button variant="ghost" onClick={() => navigate('/app')}>Skip</Button>
      </div>
      <div className="max-w-4xl mx-auto">
        <Progress />
        <div className="mt-6">
          <Routes>
            <Route index element={<BusinessBasics />} />
            <Route path="phone" element={<PhoneNumbers />} />
            <Route path="script" element={<ScriptComposer />} />
            <Route path="schedule" element={<SchedulingRules />} />
            <Route path="test" element={<TestCall />} />
          </Routes>
        </div>
      </div>
    </div>
    </OnboardingContext.Provider>
  )
}

function Progress() {
  const steps = [
    { name: 'Business', to: '/onboarding' },
    { name: 'Routing', to: '/onboarding/phone' },
    { name: 'Script', to: '/onboarding/script' },
    { name: 'Schedule', to: '/onboarding/schedule' },
    { name: 'Test', to: '/onboarding/test' },
  ]
  return (
    <div className="grid grid-cols-5 gap-2">
      {steps.map((s, i) => (
        <Link key={s.name} to={s.to} className="h-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors" aria-label={`Go to step ${i+1}: ${s.name}`} />
      ))}
    </div>
  )
}


