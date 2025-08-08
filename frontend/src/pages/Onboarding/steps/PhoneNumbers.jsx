import { useContext } from 'react'
import Button from '../../../components/ui/Button.jsx'
import { OnboardingContext } from '../OnboardingPage.jsx'

export default function PhoneNumbers() {
  const { org } = useContext(OnboardingContext)
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Routing Setup</h2>
      <p className="text-muted-foreground">We’ll provision an application number for you and configure routing from your business line.</p>
      <div className="glass rounded-lg p-4">
        <div className="text-sm text-muted-foreground">Business Line</div>
        <div className="text-lg font-medium">{org.phone || 'Not provided'}</div>
      </div>
      <Button onClick={() => (window.location.href = '/onboarding/script')}>Set Up Routing</Button>
    </div>
  )
}


