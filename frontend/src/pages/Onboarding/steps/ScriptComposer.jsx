import { useContext, useMemo, useState } from 'react'
import Button from '../../../components/ui/Button.jsx'
import Input from '../../../components/ui/Input.jsx'
import { OnboardingContext } from '../OnboardingPage.jsx'

export default function ScriptComposer() {
  const { org } = useContext(OnboardingContext)
  const defaultGreeting = useMemo(() => `You’ve reached the ${org.name || 'your'} company after‑hours agent. How can I help you?`, [org.name])
  const [greeting, setGreeting] = useState(defaultGreeting)
  const [capabilities] = useState('I can schedule appointments, take a message for a callback, or answer basic questions about hours and location.')
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Script Composer</h2>
      <div>
        <label className="block text-sm mb-1">Greeting</label>
        <Input value={greeting} onChange={(e) => setGreeting(e.target.value)} />
        <div className="text-right text-xs text-muted-foreground mt-1">{greeting.length} characters</div>
      </div>
      <div>
        <label className="block text-sm mb-1">Capabilities Prompt (read after greeting)</label>
        <Input value={capabilities} readOnly />
      </div>
      <div className="flex gap-3">
        <Button onClick={() => (window.location.href = '/onboarding/voice')}>Continue</Button>
        <Button variant="ghost" onClick={() => (window.location.href = '/onboarding/phone')}>Back</Button>
      </div>
    </div>
  )
}


