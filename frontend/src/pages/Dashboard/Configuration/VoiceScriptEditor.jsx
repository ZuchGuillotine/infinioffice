import { useState } from 'react'
import Input from '../../../components/ui/Input.jsx'
import Button from '../../../components/ui/Button.jsx'

export default function VoiceScriptEditor() {
  const [greeting, setGreeting] = useState('Hi, thanks for calling! How can I help you today?')
  const [fallback, setFallback] = useState("I'm sorry, could you repeat that?")
  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <label className="block text-sm mb-1">Greeting</label>
        <Input value={greeting} onChange={(e)=>setGreeting(e.target.value)} />
        <div className="text-right text-xs text-muted-foreground mt-1">{greeting.length} characters</div>
      </div>
      <div>
        <label className="block text-sm mb-1">Fallback</label>
        <Input value={fallback} onChange={(e)=>setFallback(e.target.value)} />
      </div>
      <div className="flex gap-3">
        <Button>Save</Button>
        <Button variant="secondary">Preview TTS</Button>
      </div>
    </div>
  )
}


