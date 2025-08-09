import { useContext, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import Button from '../../../components/ui/Button.jsx'
import Input from '../../../components/ui/Input.jsx'
import { Card, CardContent } from '../../../components/ui/Card.jsx'
import { OnboardingContext } from '../OnboardingPage.jsx'

const businessTypes = [
  { id: 'hvac', name: 'HVAC & Plumbing', icon: '🔧', desc: 'Heating, cooling & plumbing services' },
  { id: 'dental', name: 'Dental Practice', icon: '🦷', desc: 'Dental care & appointments' },
  { id: 'auto', name: 'Auto Repair', icon: '🚗', desc: 'Vehicle maintenance & repair' },
  { id: 'beauty', name: 'Beauty & Wellness', icon: '💄', desc: 'Salons, spas & wellness' },
  { id: 'other', name: 'Other Service', icon: '💼', desc: 'General service business' }
]

const timezones = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu'
]

export default function BusinessBasics() {
  const navigate = useNavigate()
  const { org, setOrg, setCompletedSteps } = useContext(OnboardingContext)
  const [selectedType, setSelectedType] = useState(org.type || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { register, handleSubmit, watch, setValue, formState: { errors, isValid } } = useForm({ 
    defaultValues: { 
      name: org.name || '', 
      phone: org.phone || '', 
      timezone: org.timezone || 'America/New_York',
      type: org.type || ''
    },
    mode: 'onChange'
  })
  
  const watchedFields = watch()
  
  const onSubmit = async (data) => {
    setIsSubmitting(true)
    try {
      // Create organization via API
      const orgData = { ...data, type: selectedType }
      
      // For now, store in context until proper backend integration
      setOrg(prev => ({ ...prev, ...orgData }))
      setCompletedSteps(prev => new Set([...prev, 0]))
      
      navigate('/onboarding/phone')
    } catch (error) {
      console.error('Failed to save business info:', error)
      // TODO: Show error toast or message
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleTypeSelect = (type) => {
    setSelectedType(type)
    setValue('type', type)
  }
  
  const completionPercentage = Object.values(watchedFields).filter(val => val && val.trim()).length / 4 * 100
  
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
          Tell us about your business
        </h2>
        <p className="text-muted-foreground text-lg">
          We'll customize your AI assistant based on your industry and needs
        </p>
        
        {/* Progress indicator */}
        <div className="mt-6 max-w-md mx-auto">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Setup Progress</span>
            <span className="text-primary font-medium">{Math.round(completionPercentage)}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-primary to-accent rounded-full h-2 transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Business Type Selection */}
        <div>
          <label className="block text-lg font-semibold mb-4">What type of business do you run?</label>
          <div className="grid md:grid-cols-3 gap-4">
            {businessTypes.map((type) => (
              <Card 
                key={type.id}
                className={`cursor-pointer transition-all duration-300 hover:scale-105 ${
                  selectedType === type.id 
                    ? 'ring-2 ring-primary border-primary bg-primary/5' 
                    : 'border-border/30 hover:border-primary/50'
                }`}
                onClick={() => handleTypeSelect(type.id)}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-3xl mb-2">{type.icon}</div>
                  <h3 className="font-semibold text-sm">{type.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{type.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {errors.type && <p className="text-red-500 text-sm mt-2">Please select your business type</p>}
        </div>
        
        {/* Business Details */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Business Name *</label>
            <Input 
              placeholder="Acme HVAC & Plumbing" 
              {...register('name', { required: 'Business name is required' })} 
              className={errors.name ? 'border-red-500' : watchedFields.name ? 'border-green-500' : ''}
              disabled={isSubmitting}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
            {watchedFields.name && !errors.name && <p className="text-green-500 text-sm mt-1">✓ Looks good!</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Primary Phone Number *</label>
            <Input 
              placeholder="+1 (555) 123-4567" 
              {...register('phone', { 
                required: 'Phone number is required',
                pattern: {
                  value: /^[\+]?[1-9][\d\s\-\(\)]{7,15}$/,
                  message: 'Please enter a valid phone number'
                }
              })} 
              className={errors.phone ? 'border-red-500' : watchedFields.phone ? 'border-green-500' : ''}
              disabled={isSubmitting}
            />
            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
            {watchedFields.phone && !errors.phone && <p className="text-green-500 text-sm mt-1">✓ Valid number!</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Timezone</label>
            <select 
              {...register('timezone')} 
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isSubmitting}
            >
              {timezones.map(tz => (
                <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex justify-between items-center pt-6 border-t border-border/20">
          <div className="text-sm text-muted-foreground">
            Step 1 of 5 • Takes about 10 minutes total
          </div>
          <Button 
            type="submit" 
            disabled={!isValid || !selectedType || isSubmitting}
            className="px-8 py-3 bg-gradient-to-r from-primary to-accent hover:shadow-lg transition-all duration-300"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              'Continue to Phone Setup →'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}