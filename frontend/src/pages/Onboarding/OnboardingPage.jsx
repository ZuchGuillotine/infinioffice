import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import Button from '../../components/ui/Button.jsx'
import BusinessBasics from './steps/BusinessBasics.jsx'
import PhoneNumbers from './steps/PhoneNumbers.jsx'
import ScriptComposer from './steps/ScriptComposer.jsx'
import SchedulingRules from './steps/SchedulingRules.jsx'
import TestCall from './steps/TestCall.jsx'
import AnimatedBackground from '../../components/ui/AnimatedBackground.jsx'
import { createContext, useMemo, useState } from 'react'

export const OnboardingContext = createContext(null)

export default function OnboardingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [org, setOrg] = useState({ name: '', phone: '', timezone: 'America/New_York' })
  const [completedSteps, setCompletedSteps] = useState(new Set())
  const ctx = useMemo(() => ({ org, setOrg, completedSteps, setCompletedSteps }), [org, completedSteps])
  
  const currentStepIndex = steps.findIndex(step => 
    location.pathname === step.to || (location.pathname === '/onboarding' && step.to === '/onboarding')
  )

  return (
    <OnboardingContext.Provider value={ctx}>
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-background to-secondary/10">
        <AnimatedBackground />
        <div className="container mx-auto px-6 py-8 relative z-10">
          <div className="flex items-center justify-between mb-12">
            <Link to="/" className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent" />
              <span className="font-bold text-xl">InfiniOffice</span>
            </Link>
            <Button variant="ghost" onClick={() => navigate('/app')} className="hover:bg-primary/10">
              Skip Setup
            </Button>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
                Let's Get Your AI Assistant Ready
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Step {currentStepIndex + 1} of {steps.length} • Just a few minutes to revolutionize your phone calls
              </p>
              <Progress currentStep={currentStepIndex} completedSteps={completedSteps} />
            </div>
            
            <div className="glass-strong rounded-2xl p-8 border border-primary/20">
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
      </div>
    </OnboardingContext.Provider>
  )
}

const steps = [
  { name: 'Business Info', desc: 'Basic details', to: '/onboarding', icon: '🏢' },
  { name: 'Phone Setup', desc: 'Connect your number', to: '/onboarding/phone', icon: '📞' },
  { name: 'AI Script', desc: 'Customize responses', to: '/onboarding/script', icon: '🤖' },
  { name: 'Scheduling', desc: 'Set availability', to: '/onboarding/schedule', icon: '📅' },
  { name: 'Test Call', desc: 'Try it out', to: '/onboarding/test', icon: '✅' },
]

function Progress({ currentStep, completedSteps }) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, i) => {
          const isCompleted = completedSteps.has(i)
          const isCurrent = i === currentStep
          const isUpcoming = i > currentStep
          
          return (
            <div key={step.name} className="flex flex-col items-center">
              <Link 
                to={step.to} 
                className={`
                  relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300
                  ${isCompleted ? 'bg-green-500 border-green-500 text-white' :
                    isCurrent ? 'bg-primary border-primary text-white animate-pulse' :
                    isUpcoming ? 'bg-secondary border-secondary text-muted-foreground' :
                    'bg-muted border-muted-foreground/20 text-muted-foreground'
                  }
                `}
              >
                {isCompleted ? '✓' : step.icon}
              </Link>
              <div className="mt-3 text-center">
                <p className={`text-sm font-medium ${
                  isCurrent ? 'text-primary' : 
                  isCompleted ? 'text-green-500' : 
                  'text-muted-foreground'
                }`}>
                  {step.name}
                </p>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Progress line */}
      <div className="absolute top-6 left-6 right-6 h-0.5 bg-secondary -z-10">
        <div 
          className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-700 ease-out"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  )
}