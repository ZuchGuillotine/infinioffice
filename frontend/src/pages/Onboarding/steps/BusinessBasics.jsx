import { useContext } from 'react'
import { useForm } from 'react-hook-form'
import Button from '../../../components/ui/Button.jsx'
import Input from '../../../components/ui/Input.jsx'
import { OnboardingContext } from '../OnboardingPage.jsx'

export default function BusinessBasics() {
  const { org, setOrg } = useContext(OnboardingContext)
  const { register, handleSubmit, watch } = useForm({ defaultValues: { name: org.name, phone: org.phone, timezone: org.timezone } })
  const onSubmit = (data) => { setOrg(prev => ({ ...prev, ...data })); window.location.href = '/onboarding/phone' }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-2xl font-semibold">Business Basics</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">Business Name</label>
          <Input placeholder="Acme HVAC" {...register('name')} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Primary Phone</label>
          <Input placeholder="+1 (555) 555-5555" {...register('phone')} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Timezone</label>
          <Input placeholder="America/New_York" {...register('timezone')} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit">Continue</Button>
      </div>
    </form>
  )
}


