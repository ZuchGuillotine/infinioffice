/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 16/08/2025 - 14:07:07
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 16/08/2025
    * - Author          : 
    * - Modification    : 
**/
import { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import StatusIndicator from '../../../components/ui/StatusIndicator';
import apiClient from '../../../lib/api';

const AVAILABLE_VOICES = [
  { id: 'saturn', name: 'Saturn', description: 'Deep, authoritative male voice' },
  { id: 'harmonia', name: 'Harmonia', description: 'Warm, friendly female voice' },
  { id: 'hera', name: 'Hera', description: 'Professional, confident female voice' },
  { id: 'zeus', name: 'Zeus', description: 'Strong, commanding male voice' }
]

export default function VoiceSettingsEditor() {
  const { user } = useAuth()
  const [selectedVoice, setSelectedVoice] = useState('')
  const [testScript, setTestScript] = useState('Hello! This is a test of your selected voice. How does it sound?')
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testStatus, setTestStatus] = useState('idle')
  const [currentSettings, setCurrentSettings] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (user) {
      loadCurrentSettings();
    }
  }, [user]);

  const loadCurrentSettings = async () => {
    try {
      setIsLoading(true)
      const config = await apiClient.get('/voice/settings')
      setCurrentSettings(config)
      if (config.voiceSettings?.voiceModel) {
        setSelectedVoice(config.voiceSettings.voiceModel)
      }
    } catch (error) {
      console.error('Error loading voice settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveVoiceSettings = async () => {
    if (!selectedVoice) {
      alert('Please select a voice first')
      return
    }

    try {
      setIsSaving(true)
      await apiClient.post('/voice/settings', {
        voiceModel: selectedVoice
      })
      alert('Voice settings saved successfully!')
      await loadCurrentSettings()
    } catch (error) {
      console.error('Error saving voice settings:', error)
      alert(`Error saving voice settings: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const testVoice = async () => {
    if (!selectedVoice || !testScript.trim()) {
      alert('Please select a voice and enter a test script')
      return
    }

    try {
      setIsTesting(true)
      setTestStatus('testing')
      
      // Use a custom request since we need to handle binary data
      const url = `${apiClient.baseURL}/api/voice/test`;
      const response = await fetch(url, {
        method: 'POST',
        headers: apiClient.getHeaders(),
        body: JSON.stringify({
          text: testScript,
          voiceModel: selectedVoice
        })
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        
        // Create and play audio
        const audio = new Audio(audioUrl)
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          setTestStatus('completed')
        }
        audio.onerror = () => {
          setTestStatus('error')
          alert('Error playing audio')
        }
        
        await audio.play()
      } else {
        const error = await response.json()
        alert(`Error testing voice: ${error.message}`)
        setTestStatus('error')
      }
    } catch (error) {
      console.error('Error testing voice:', error)
      alert('Error testing voice')
      setTestStatus('error')
    } finally {
      setIsTesting(false)
    }
  }

  const getStatusColor = () => {
    switch (testStatus) {
      case 'testing': return 'processing'
      case 'completed': return 'online'
      case 'error': return 'offline'
      default: return 'connecting'
    }
  }

  const getStatusText = () => {
    switch (testStatus) {
      case 'testing': return 'Testing...'
      case 'completed': return 'Test completed'
      case 'error': return 'Test failed'
      default: return 'Ready to test'
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Voice Settings</h3>
        <p className="text-sm text-muted-foreground">
          Choose the voice that will be used for your phone system. You can test different voices before making your selection.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Voice</CardTitle>
          <CardDescription>
            Choose from our available Deepgram voices. The selected voice will be used for all incoming calls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AVAILABLE_VOICES.map((voice) => (
              <div
                key={voice.id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedVoice === voice.id
                    ? 'border-primary bg-primary bg-opacity-5'
                    : 'border-gray-300 hover:border-primary/50'
                }`}
                onClick={() => setSelectedVoice(voice.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{voice.name}</h4>
                    <p className="text-sm text-muted-foreground">{voice.description}</p>
                  </div>
                  {selectedVoice === voice.id && (
                    <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={saveVoiceSettings}
              disabled={!selectedVoice || isSaving}
              className="flex-1"
            >
              {isSaving ? <LoadingSpinner className="w-4 h-4" /> : 'Save Voice Selection'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Your Voice</CardTitle>
          <CardDescription>
            Test the selected voice with a custom script to make sure it sounds right for your business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="testScript" className="block text-sm font-medium mb-2">
              Test Script
            </label>
            <Input
              id="testScript"
              value={testScript}
              onChange={(e) => setTestScript(e.target.value)}
              placeholder="Enter text to test the voice..."
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={testVoice}
              disabled={!selectedVoice || !testScript.trim() || isTesting}
              className="flex-1"
            >
              {isTesting ? <LoadingSpinner className="w-4 h-4" /> : 'Test Voice'}
            </Button>
            
            <div className="flex items-center gap-2">
              <StatusIndicator status={getStatusColor()} />
              <span className="text-sm text-muted-foreground">{getStatusText()}</span>
            </div>
          </div>

          {currentSettings?.voiceSettings?.voiceModel && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Current voice:</strong> {AVAILABLE_VOICES.find(v => v.id === currentSettings.voiceSettings.voiceModel)?.name || currentSettings.voiceSettings.voiceModel}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Voice Information</CardTitle>
          <CardDescription>
            Learn more about our available voices and how they can enhance your customer experience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-sm">Saturn</h4>
              <p className="text-sm text-muted-foreground">
                A deep, authoritative male voice perfect for professional services and businesses that want to convey trust and expertise.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm">Harmonia</h4>
              <p className="text-sm text-muted-foreground">
                A warm, friendly female voice ideal for customer service and businesses that want to create a welcoming atmosphere.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm">Hera</h4>
              <p className="text-sm text-muted-foreground">
                A professional, confident female voice great for corporate environments and businesses that want to project competence.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm">Zeus</h4>
              <p className="text-sm text-muted-foreground">
                A strong, commanding male voice perfect for industries like construction, automotive, or any business that want to project strength and reliability.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}