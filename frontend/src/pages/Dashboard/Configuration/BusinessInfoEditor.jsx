import { useState, useEffect } from 'react'
import { useApi, useMutation } from '../../../hooks/useApi'
import { organizations } from '../../../lib/api'
import Input from '../../../components/ui/Input.jsx'
import Button from '../../../components/ui/Button.jsx'
import LoadingSpinner from '../../../components/ui/LoadingSpinner.jsx'

export default function BusinessInfoEditor() {
  const [formData, setFormData] = useState({
    name: '',
    timezone: ''
  })

  const { data: organization, loading, refetch } = useApi(organizations.get, [])
  const { mutate: updateOrg, loading: saving } = useMutation(
    organizations.update,
    {
      onSuccess: () => {
        refetch()
      }
    }
  )

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        timezone: organization.businessConfig?.timezone || 'America/New_York'
      })
    }
  }, [organization])

  const handleSubmit = (e) => {
    e.preventDefault()
    updateOrg(formData)
  }

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* InfiniOffice Number Display */}
      <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
        <h3 className="font-semibold text-primary mb-2">InfiniOffice Number</h3>
        {organization?.twilioNumber ? (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-mono font-bold text-primary">
              {organization.twilioNumber}
            </span>
            <span className="text-sm text-muted-foreground">
              This is your dedicated phone number for customer calls
            </span>
          </div>
        ) : (
          <div className="text-amber-600 text-sm">
            ⚠️ No phone number assigned yet. Complete the onboarding process to receive your InfiniOffice number.
          </div>
        )}
      </div>

      {/* Business Information Form */}
      <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">Business Name</label>
          <Input 
            placeholder="Acme HVAC" 
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Timezone</label>
          <Input 
            placeholder="America/New_York" 
            value={formData.timezone}
            onChange={(e) => updateField('timezone', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Plan</label>
          <Input 
            value={organization?.plan || 'starter'}
            disabled
            className="bg-gray-50 text-gray-500"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Escalation Number (optional)</label>
          <Input 
            placeholder="+1 (555) 000-0000" 
            value={organization?.businessConfig?.escalationNumber || ''}
            disabled
            className="bg-gray-50 text-gray-500"
          />
          <p className="text-xs text-muted-foreground mt-1">Configure in Scheduling settings</p>
        </div>
        <div className="md:col-span-2 flex justify-end pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}


