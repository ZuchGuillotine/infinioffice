import { useState, useEffect } from 'react'
import Button from '../../../components/ui/Button.jsx'
import Input from '../../../components/ui/Input.jsx'
import LoadingSpinner from '../../../components/ui/LoadingSpinner.jsx'
import { useApi, useMutation } from '../../../hooks/useApi'
import { services as servicesAPI } from '../../../lib/api'

export default function ServicesEditor() {
  const [localServices, setLocalServices] = useState([])
  const [hasChanges, setHasChanges] = useState(false)

  // Load services from API
  const { data: services, loading, error, refetch } = useApi(servicesAPI.list, [])
  
  // Sync API data with local state
  useEffect(() => {
    if (services) {
      setLocalServices(services)
      setHasChanges(false)
    }
  }, [services])
  
  // Save changes mutation
  const { mutate: saveServices, loading: saving } = useMutation(servicesAPI.bulkUpdate, {
    onSuccess: () => {
      refetch()
      setHasChanges(false)
    }
  })

  function updateService(index, field, value) {
    setLocalServices(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
    setHasChanges(true)
  }

  function addService() {
    setLocalServices(prev => [...prev, { id: Date.now(), name: '', duration: 30 }])
    setHasChanges(true)
  }

  function removeService(index) {
    setLocalServices(prev => prev.filter((_, i) => i !== index))
    setHasChanges(true)
  }

  function handleSave() {
    saveServices({ services: localServices })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-muted rounded w-1/3 animate-pulse"></div>
        <div className="space-y-3 max-w-3xl">
          {Array.from({length: 3}).map((_, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center animate-pulse">
              <div className="col-span-6">
                <div className="h-4 bg-muted rounded w-1/4 mb-1"></div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
              <div className="col-span-3">
                <div className="h-4 bg-muted rounded w-1/2 mb-1"></div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
              <div className="col-span-3">
                <div className="h-10 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 border border-red-200 rounded-lg bg-red-50">
        <p className="text-red-600">Failed to load services: {error.message}</p>
        <Button onClick={refetch} variant="outline" className="mt-2">Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Appointment Types</h3>
        <Button onClick={addService} disabled={saving}>Add Service</Button>
      </div>
      <div className="space-y-3 max-w-3xl">
        {localServices.map((s, i) => (
          <div key={s.id} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-6">
              <label className="block text-xs mb-1">Name</label>
              <Input 
                value={s.name} 
                onChange={(e)=>updateService(i, 'name', e.target.value)} 
                placeholder="Consultation"
                disabled={saving}
              />
            </div>
            <div className="col-span-3">
              <label className="block text-xs mb-1">Duration (mins)</label>
              <Input 
                type="number" 
                value={s.duration} 
                onChange={(e)=>updateService(i, 'duration', Number(e.target.value))}
                disabled={saving}
              />
            </div>
            <div className="col-span-3 text-right">
              <Button 
                variant="outline" 
                onClick={() => removeService(i)}
                disabled={saving}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="text-right max-w-3xl">
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || saving}
        >
          {saving ? <LoadingSpinner size="sm" /> : 'Save'}
        </Button>
      </div>
    </div>
  )
}


