import { useState } from 'react'
import Input from '../../../components/ui/Input.jsx'
import Button from '../../../components/ui/Button.jsx'

export default function SchedulingEditor() {
  const [hours, setHours] = useState({
    monday: { start: '09:00', end: '17:00' },
    tuesday: { start: '09:00', end: '17:00' },
    wednesday: { start: '09:00', end: '17:00' },
    thursday: { start: '09:00', end: '17:00' },
    friday: { start: '09:00', end: '17:00' },
    saturday: { start: '', end: '' },
    sunday: { start: '', end: '' },
  })

  function update(day, field, value) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Business Hours</h3>
      <div className="grid md:grid-cols-2 gap-3 max-w-3xl">
        {Object.entries(hours).map(([day, val]) => (
          <div key={day} className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-4 capitalize text-sm">{day}</div>
            <div className="col-span-4"><Input type="time" value={val.start} onChange={(e)=>update(day,'start',e.target.value)} /></div>
            <div className="col-span-4"><Input type="time" value={val.end} onChange={(e)=>update(day,'end',e.target.value)} /></div>
          </div>
        ))}
      </div>
      <div className="max-w-3xl">
        <h4 className="mt-6 mb-2 font-medium">Rules</h4>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Default slot (mins)</label>
            <Input type="number" defaultValue={30} />
          </div>
          <div>
            <label className="block text-sm mb-1">Buffer (mins)</label>
            <Input type="number" defaultValue={10} />
          </div>
          <div>
            <label className="block text-sm mb-1">Double-booking</label>
            <select className="w-full h-10 rounded-md border border-input bg-transparent px-3"><option>No</option><option>Yes</option></select>
          </div>
        </div>
      </div>
      <div className="text-right max-w-3xl">
        <Button>Save</Button>
      </div>
    </div>
  )
}


