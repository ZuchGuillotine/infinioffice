import { useApi, useMutation } from '../../hooks/useApi'
import { organizations } from '../../lib/api'
import Button from '../../components/ui/Button.jsx'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'

export default function IntegrationsPage() {
  const { user } = useAuth()
  const { data: integrations, loading, error, refetch } = useApi(organizations.getIntegrations)
  const [connectingType, setConnectingType] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  
  // Add debug logging
  useEffect(() => {
    console.log('IntegrationsPage mounted')
    console.log('User:', user)
    console.log('Integrations data:', integrations)
    console.log('Loading:', loading)
    console.log('Error:', error)
  }, [user, integrations, loading, error])
  
  const { mutate: createIntegration, loading: connecting } = useMutation(
    organizations.createIntegration,
    {
      onSuccess: () => {
        refetch()
        setConnectingType(null)
      }
    }
  )

  const { mutate: deleteIntegration, loading: disconnecting } = useMutation(
    organizations.deleteIntegration,
    {
      onSuccess: () => {
        refetch()
      }
    }
  )

  // Handle URL parameters for success/error messages
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const error = urlParams.get('error')
    
    if (success) {
      setSuccessMessage(`Successfully connected ${success.replace('-', ' ')}!`)
      setErrorMessage('')
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname)
      // Refetch integrations to show updated status
      refetch()
    } else if (error) {
      setErrorMessage(`Failed to connect ${error.replace('-', ' ')}. Please try again.`)
      setSuccessMessage('')
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [refetch])

  function handleConnect(integrationType) {
    if (!user?.organizationId) {
      setErrorMessage('Organization ID not found. Please refresh the page and try again.')
      return
    }
    
    setConnectingType(integrationType)
    
    if (integrationType === 'google-calendar') {
      // Trigger Google OAuth flow
      window.location.href = `/api/auth/google-calendar?organizationId=${user.organizationId}`
    } else if (integrationType === 'hubspot') {
      // Trigger HubSpot OAuth flow
      window.location.href = `/api/auth/hubspot?organizationId=${user.organizationId}`
    } else if (integrationType === 'salesforce') {
      // Trigger Salesforce OAuth flow
      window.location.href = `/api/auth/salesforce?organizationId=${user.organizationId}`
    } else if (integrationType === 'pipedrive') {
      // Trigger Pipedrive OAuth flow
      window.location.href = `/api/auth/pipedrive?organizationId=${user.organizationId}`
    } else if (integrationType === 'apple-calendar' || integrationType === 'outlook-calendar') {
      // These integrations are not yet implemented
      setErrorMessage(`${integrationType === 'apple-calendar' ? 'Apple Calendar' : 'Outlook Calendar'} integration is coming soon! We're working on implementing secure calendar sync for these platforms.`)
      setConnectingType(null)
    } else {
      // For any other integrations, create them normally
      createIntegration({ type: integrationType })
    }
  }

  function handleDisconnect(integrationType) {
    deleteIntegration(integrationType)
  }

  // Add debug rendering
  console.log('Rendering IntegrationsPage')

  if (loading) {
    console.log('Showing loading state')
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Integrations</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass rounded-lg p-4 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    console.log('Showing error state:', error)
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Integrations</h2>
        <div className="text-red-600 p-4 border border-red-200 rounded-md">
          Error loading integrations: {error.message}
          <Button onClick={refetch} variant="outline" className="ml-2">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const availableIntegrations = [
    // Calendar Integrations
    { 
      type: 'google-calendar', 
      name: 'Google Calendar', 
      description: 'Sync appointments with Google Calendar',
      category: 'calendar',
      icon: '📅',
      features: ['Real-time sync', 'Conflict detection', 'Recurring events', 'Multiple calendars'],
      setupTime: '2-3 minutes'
    },
    { 
      type: 'outlook-calendar', 
      name: 'Outlook Calendar', 
      description: 'Sync appointments with Outlook and Microsoft 365 (Coming Soon)',
      category: 'calendar',
      icon: '📆',
      features: ['Office 365 integration', 'Exchange support', 'Team calendar sync', 'Meeting scheduling'],
      setupTime: '3-5 minutes'
    },
    { 
      type: 'apple-calendar', 
      name: 'Apple Calendar', 
      description: 'Sync with Apple Calendar and iCloud (Coming Soon)',
      category: 'calendar',
      icon: '🍎',
      features: ['iCloud sync', 'iOS integration', 'Family sharing', 'Siri integration'],
      setupTime: '2-3 minutes'
    },
    
    // CRM Integrations
    { 
      type: 'hubspot', 
      name: 'HubSpot CRM', 
      description: 'Manage contacts, deals, and customer relationships',
      category: 'crm',
      icon: '🔄',
      features: ['Contact management', 'Deal tracking', 'Email marketing', 'Analytics'],
      setupTime: '5-7 minutes'
    },
    { 
      type: 'salesforce', 
      name: 'Salesforce', 
      description: 'Enterprise CRM with advanced sales and service features',
      category: 'crm',
      icon: '☁️',
      features: ['Lead management', 'Opportunity tracking', 'Service cloud', 'Advanced reporting'],
      setupTime: '7-10 minutes'
    },
    { 
      type: 'pipedrive', 
      name: 'Pipedrive', 
      description: 'Simple CRM focused on sales pipeline management',
      category: 'crm',
      icon: '📊',
      features: ['Pipeline management', 'Deal tracking', 'Activity logging', 'Sales reporting'],
      setupTime: '4-6 minutes'
    }
  ]

  const calendarIntegrations = availableIntegrations.filter(i => i.category === 'calendar')
  const crmIntegrations = availableIntegrations.filter(i => i.category === 'crm')

  console.log('Rendering main integrations content')
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Integrations</h2>
        <p className="text-muted-foreground">Connect your favorite tools to enhance your workflow and automate your business processes.</p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span className="text-green-800">{successMessage}</span>
            <button 
              onClick={() => setSuccessMessage('')}
              className="ml-auto text-green-600 hover:text-green-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center gap-2">
            <span className="text-red-600">✗</span>
            <span className="text-red-800">{errorMessage}</span>
            <button 
              onClick={() => setErrorMessage('')}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Calendar Integrations */}
      <div>
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <span>📅</span>
          Calendar Integrations
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {calendarIntegrations.map(integration => {
            const isConnected = integrations?.some(i => i.type === integration.type && i.status === 'active')
            const isConnecting = connectingType === integration.type
            const isComingSoon = integration.type === 'apple-calendar' || integration.type === 'outlook-calendar'
            
            return (
              <Card key={integration.type} className={`hover:shadow-lg transition-shadow ${isComingSoon ? 'opacity-75' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{integration.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <div className={`px-2 py-1 rounded-full text-xs w-fit ${
                          isComingSoon 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : isConnected 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isComingSoon ? 'Coming Soon' : (isConnected ? 'Connected' : 'Not connected')}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground mb-4">
                    {integration.description}
                  </p>
                  
                  <div className="mb-4">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Key Features:</div>
                    <ul className="text-xs space-y-1">
                      {integration.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="text-green-500">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="text-xs text-muted-foreground mb-4">
                    Setup time: {integration.setupTime}
                  </div>

                  <div className="flex gap-2">
                    {isComingSoon ? (
                      <Button 
                        size="sm"
                        disabled
                        className="w-full bg-yellow-100 text-yellow-800 border-yellow-200 cursor-not-allowed"
                      >
                        Coming Soon
                      </Button>
                    ) : isConnected ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDisconnect(integration.type)}
                        disabled={disconnecting}
                        className="w-full"
                      >
                        {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                      </Button>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => handleConnect(integration.type)}
                        disabled={isConnecting}
                        className="w-full"
                      >
                        {isConnecting ? 'Connecting...' : 'Connect'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* CRM Integrations */}
      <div>
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <span>👥</span>
          CRM Integrations
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {crmIntegrations.map(integration => {
            const isConnected = integrations?.some(i => i.type === integration.type && i.status === 'active')
            const isConnecting = connectingType === integration.type
            
            return (
              <Card key={integration.type} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{integration.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <div className={`px-2 py-1 rounded-full text-xs w-fit ${
                          isConnected 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isConnected ? 'Connected' : 'Not connected'}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground mb-4">
                    {integration.description}
                  </p>
                  
                  <div className="mb-4">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Key Features:</div>
                    <ul className="text-xs space-y-1">
                      {integration.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="text-green-500">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="text-xs text-muted-foreground mb-4">
                    Setup time: {integration.setupTime}
                  </div>

                  <div className="flex gap-2">
                    {isConnected ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDisconnect(integration.type)}
                        disabled={disconnecting}
                        className="w-full"
                      >
                        {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                      </Button>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => handleConnect(integration.type)}
                        disabled={isConnecting}
                        className="w-full"
                      >
                        {isConnecting ? 'Connecting...' : 'Connect'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
      
      {integrations?.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No integrations configured yet.</p>
          <p className="text-sm">Connect your favorite tools to enhance your workflow.</p>
        </div>
      )}

      {/* Integration Benefits */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-3 text-blue-900">Why Integrate?</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <h4 className="font-medium mb-2">Calendar Integrations</h4>
              <ul className="space-y-1">
                <li>• Automatic appointment scheduling</li>
                <li>• Real-time availability updates</li>
                <li>• Conflict prevention</li>
                <li>• Multi-calendar support</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">CRM Integrations</h4>
              <ul className="space-y-1">
                <li>• Customer data synchronization</li>
                <li>• Lead and deal tracking</li>
                <li>• Automated follow-ups</li>
                <li>• Enhanced customer insights</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


