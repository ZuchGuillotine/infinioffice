import { useState } from 'react'
import Button from '../../../components/ui/Button.jsx'
import Input from '../../../components/ui/Input.jsx'

export default function ServicesEditor() {
  const [services, setServices] = useState([
    { id: 1, name: 'Consultation', duration: 30 },
    { id: 2, name: 'Maintenance', duration: 60 },
  ])

  function updateService(index, field, value) {
    setServices(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  function addService() {
    setServices(prev => [...prev, { id: Date.now(), name: '', duration: 30 }])
  }

  function removeService(index) {
    setServices(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Appointment Types</h3>
        <Button onClick={addService}>Add Service</Button>
      </div>
      <div className="space-y-3 max-w-3xl">
        {services.map((s, i) => (
          <div key={s.id} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-6">
              <label className="block text-xs mb-1">Name</label>
              <Input value={s.name} onChange={(e)=>updateService(i, 'name', e.target.value)} placeholder="Consultation" />
            </div>
            <div className="col-span-3">
              <label className="block text-xs mb-1">Duration (mins)</label>
              <Input type="number" value={s.duration} onChange={(e)=>updateService(i, 'duration', Number(e.target.value))} />
            </div>
            <div className="col-span-3 text-right">
              <Button variant="outline" onClick={() => removeService(i)}>Remove</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="text-right max-w-3xl">
        <Button>Save</Button>
      </div>
    </div>
  )
}


