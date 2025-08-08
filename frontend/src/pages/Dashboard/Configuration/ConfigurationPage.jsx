import { Routes, Route, NavLink } from 'react-router-dom'
import ServicesEditor from './ServicesEditor.jsx'
import BusinessInfoEditor from './BusinessInfoEditor.jsx'
import SchedulingEditor from './SchedulingEditor.jsx'
import VoiceScriptEditor from './VoiceScriptEditor.jsx'

export default function ConfigurationPage() {
  const tabs = [
    { to: '', label: 'Business Info' },
    { to: 'services', label: 'Services' },
    { to: 'scheduling', label: 'Scheduling' },
    { to: 'voice', label: 'Voice Scripts' },
  ]
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Configuration</h2>
      <div className="flex gap-2 mb-4 border-b border-border">
        {tabs.map(t => (
          <NavLink key={t.label} to={t.to} end className={({isActive}) => `px-4 py-2 -mb-px border-b-2 ${isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t.label}</NavLink>
        ))}
      </div>
      <Routes>
        <Route index element={<BusinessInfoEditor />} />
        <Route path="services" element={<ServicesEditor />} />
        <Route path="scheduling" element={<SchedulingEditor />} />
        <Route path="voice" element={<VoiceScriptEditor />} />
      </Routes>
    </div>
  )
}


