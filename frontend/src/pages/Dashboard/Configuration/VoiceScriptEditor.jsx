import { useState, useEffect } from 'react'
import { useApi, useMutation } from '../../../hooks/useApi'
import { organizations, voice } from '../../../lib/api'
import Input from '../../../components/ui/Input.jsx'
import Button from '../../../components/ui/Button.jsx'

export default function VoiceScriptEditor() {
  const [localVoiceConfig, setLocalVoiceConfig] = useState({
    greeting: 'Hi, thanks for calling! How can I help you today?',
    fallback: "I'm sorry, could you repeat that?"
  })

  const { data: voiceConfig, loading, error, refetch } = useApi(organizations.getVoiceConfig)
  
  const { mutate: saveVoiceConfig, loading: saving } = useMutation(
    organizations.updateVoiceConfig,
    {
      onSuccess: () => {
        refetch()
      }
    }
  )

  const { mutate: previewTTS, loading: previewing } = useMutation(voice.preview)

  useEffect(() => {
    if (voiceConfig) {
      setLocalVoiceConfig(voiceConfig)
    }
  }, [voiceConfig])

  function updateField(field, value) {
    setLocalVoiceConfig(prev => ({ ...prev, [field]: value }))
  }

  function handleSave() {
    saveVoiceConfig(localVoiceConfig)
  }

  function handlePreview() {
    previewTTS({ 
      text: localVoiceConfig.greeting,
      voiceId: voiceConfig?.voiceId || 'Joanna'
    })
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-20"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="flex gap-3">
            <div className="h-10 w-16 bg-gray-200 rounded"></div>
            <div className="h-10 w-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="text-red-600 p-4 border border-red-200 rounded-md">
          Error loading voice configuration: {error.message}
          <Button onClick={refetch} variant="outline" className="ml-2">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <label className="block text-sm mb-1">Greeting</label>
        <Input 
          value={localVoiceConfig.greeting} 
          onChange={(e) => updateField('greeting', e.target.value)} 
        />
        <div className="text-right text-xs text-muted-foreground mt-1">
          {localVoiceConfig.greeting.length} characters
        </div>
      </div>
      <div>
        <label className="block text-sm mb-1">Fallback</label>
        <Input 
          value={localVoiceConfig.fallback} 
          onChange={(e) => updateField('fallback', e.target.value)} 
        />
      </div>
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="secondary" onClick={handlePreview} disabled={previewing}>
          {previewing ? 'Generating...' : 'Preview TTS'}
        </Button>
      </div>
    </div>
  )
}


