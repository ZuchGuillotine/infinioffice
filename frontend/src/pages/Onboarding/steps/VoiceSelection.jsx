import { useContext, useState, useRef } from 'react'
import Button from '../../../components/ui/Button.jsx'
import Select from '../../../components/ui/Select.jsx'
import { OnboardingContext } from '../OnboardingPage.jsx'

export default function VoiceSelection() {
  const { org, setOrg } = useContext(OnboardingContext)
  const [selectedVoice, setSelectedVoice] = useState(org.voiceSettings?.voiceModel || 'aura-aurora-en')
  const [isPlaying, setIsPlaying] = useState(false)
  const [testText, setTestText] = useState(`Hello! You've reached ${org.name || 'our company'}. I'm your AI assistant and I'm here to help you schedule an appointment. How can I assist you today?`)
  const audioRef = useRef(null)

  const voices = [
    { value: 'aura-aurora-en', label: 'Aurora', description: 'Warm and professional female voice' },
    { value: 'aura-harmonia-en', label: 'Harmonia', description: 'Elegant and articulate female voice' },
    { value: 'aura-zeus-en', label: 'Zeus', description: 'Authoritative and confident male voice' },
    { value: 'aura-saturn-en', label: 'Saturn', description: 'Deep and reassuring male voice' }
  ]

  const handleVoiceChange = (value) => {
    setSelectedVoice(value)
    setOrg(prev => ({
      ...prev,
      voiceSettings: {
        ...prev.voiceSettings,
        voiceModel: value,
        speed: 1.0,
        pitch: 1.0
      }
    }))
  }

  const saveVoiceSettings = async () => {
    try {
      const response = await fetch('/api/organizations/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voiceSettings: {
            voiceModel: selectedVoice,
            speed: 1.0,
            pitch: 1.0
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save voice settings')
      }

      console.log('Voice settings saved successfully')
    } catch (error) {
      console.error('Error saving voice settings:', error)
    }
  }

  const handleContinue = async () => {
    await saveVoiceSettings()
    window.location.href = '/onboarding/schedule'
  }

  const handleTestVoice = async () => {
    setIsPlaying(true)
    try {
      const response = await fetch('/api/voice/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: testText,
          voiceModel: selectedVoice
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate voice preview')
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.play()
      }
    } catch (error) {
      console.error('Error testing voice:', error)
      alert('Failed to test voice. Please try again.')
    } finally {
      setIsPlaying(false)
    }
  }

  const selectedVoiceInfo = voices.find(v => v.value === selectedVoice)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Choose Your AI Voice</h2>
        <p className="text-muted-foreground">
          Select the voice that best represents your brand and test it with your greeting.
        </p>
      </div>

      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Voice Selection</label>
          <Select
            value={selectedVoice}
            onChange={(e) => handleVoiceChange(e.target.value)}
          >
            {voices.map((voice) => (
              <option key={voice.value} value={voice.value}>
                {voice.label} - {voice.description}
              </option>
            ))}
          </Select>
          {selectedVoiceInfo && (
            <p className="text-sm text-muted-foreground mt-2">
              {selectedVoiceInfo.description}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Test Script</label>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            className="w-full p-3 border border-input rounded-md resize-none h-24 text-sm"
            placeholder="Enter text to test the voice..."
          />
          <div className="text-right text-xs text-muted-foreground mt-1">
            {testText.length} characters
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleTestVoice}
            disabled={isPlaying || !testText.trim()}
            variant="secondary"
            className="flex items-center gap-2"
          >
            {isPlaying ? (
              <>
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <span>🔊</span>
                Test Voice
              </>
            )}
          </Button>
        </div>

        <audio
          ref={audioRef}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            setIsPlaying(false)
            alert('Error playing audio. Please try again.')
          }}
          style={{ display: 'none' }}
        />

        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
          <h3 className="font-medium mb-2">💡 Voice Selection Tips</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Aurora:</strong> Perfect for healthcare and professional services</li>
            <li>• <strong>Harmonia:</strong> Great for luxury and premium brands</li>
            <li>• <strong>Zeus:</strong> Ideal for automotive and technical services</li>
            <li>• <strong>Saturn:</strong> Excellent for financial and legal services</li>
          </ul>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button onClick={handleContinue}>
          Continue with {selectedVoiceInfo?.label}
        </Button>
        <Button 
          variant="ghost" 
          onClick={() => (window.location.href = '/onboarding/script')}
        >
          Back
        </Button>
      </div>
    </div>
  )
}