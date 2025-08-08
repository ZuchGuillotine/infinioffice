import { useState } from 'react'
import Button from '../../../components/ui/Button.jsx'

export default function SchedulingRules() {
  const [slot, setSlot] = useState(30)
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Scheduling Rules</h2>
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm mb-1">Default Slot (mins)</label>
          <input type="number" value={slot} onChange={(e)=>setSlot(Number(e.target.value))} className="w-full h-10 rounded-md border border-input bg-transparent px-3" />
        </div>
        <div>
          <label className="block text-sm mb-1">Buffer (mins)</label>
          <input type="number" defaultValue={10} className="w-full h-10 rounded-md border border-input bg-transparent px-3" />
        </div>
        <div>
          <label className="block text-sm mb-1">Double-booking</label>
          <select className="w-full h-10 rounded-md border border-input bg-transparent px-3"><option>No</option><option>Yes</option></select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => (window.location.href = '/onboarding/test')}>Continue</Button>
      </div>
    </div>
  )
}


