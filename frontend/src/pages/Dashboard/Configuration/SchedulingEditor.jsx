import { useState, useEffect } from 'react'
import { useApi, useMutation } from '../../../hooks/useApi'
import { organizations } from '../../../lib/api'
import Input from '../../../components/ui/Input.jsx'
import Button from '../../../components/ui/Button.jsx'

export default function SchedulingEditor() {
  const [localSchedule, setLocalSchedule] = useState({
    hours: {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
      saturday: { start: '', end: '' },
      sunday: { start: '', end: '' },
    },
    defaultSlotDuration: 30,
    bufferTime: 10,
    allowDoubleBooking: false
  })

  const { data: schedule, loading, error, refetch } = useApi(organizations.getSchedule)
  
  const { mutate: saveSchedule, loading: saving } = useMutation(
    organizations.updateSchedule,
    {
      onSuccess: () => {
        refetch()
      }
    }
  )

  useEffect(() => {
    if (schedule) {
      setLocalSchedule(schedule)
    }
  }, [schedule])

  function updateHours(day, field, value) {
    setLocalSchedule(prev => ({
      ...prev,
      hours: {
        ...prev.hours,
        [day]: { ...prev.hours[day], [field]: value }
      }
    }))
  }

  function updateSetting(field, value) {
    setLocalSchedule(prev => ({ ...prev, [field]: value }))
  }

  function handleSave() {
    saveSchedule(localSchedule)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Business Hours</h3>
        <div className="animate-pulse space-y-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2 max-w-3xl">
              <div className="col-span-4 h-4 bg-gray-200 rounded"></div>
              <div className="col-span-4 h-10 bg-gray-200 rounded"></div>
              <div className="col-span-4 h-10 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Business Hours</h3>
        <div className="text-red-600 p-4 border border-red-200 rounded-md">
          Error loading schedule: {error.message}
          <Button onClick={refetch} variant="outline" className="ml-2">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Business Hours</h3>
      <div className="grid md:grid-cols-2 gap-3 max-w-3xl">
        {Object.entries(localSchedule.hours).map(([day, val]) => (
          <div key={day} className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-4 capitalize text-sm">{day}</div>
            <div className="col-span-4">
              <Input 
                type="time" 
                value={val.start} 
                onChange={(e) => updateHours(day, 'start', e.target.value)} 
              />
            </div>
            <div className="col-span-4">
              <Input 
                type="time" 
                value={val.end} 
                onChange={(e) => updateHours(day, 'end', e.target.value)} 
              />
            </div>
          </div>
        ))}
      </div>
      <div className="max-w-3xl">
        <h4 className="mt-6 mb-2 font-medium">Rules</h4>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Default slot (mins)</label>
            <Input 
              type="number" 
              value={localSchedule.defaultSlotDuration} 
              onChange={(e) => updateSetting('defaultSlotDuration', parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Buffer (mins)</label>
            <Input 
              type="number" 
              value={localSchedule.bufferTime} 
              onChange={(e) => updateSetting('bufferTime', parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Double-booking</label>
            <select 
              className="w-full h-10 rounded-md border border-input bg-transparent px-3"
              value={localSchedule.allowDoubleBooking ? 'Yes' : 'No'}
              onChange={(e) => updateSetting('allowDoubleBooking', e.target.value === 'Yes')}
            >
              <option>No</option>
              <option>Yes</option>
            </select>
          </div>
        </div>
      </div>
      <div className="text-right max-w-3xl">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}


