import { useApi, useMutation } from '../../hooks/useApi'
import { organizations } from '../../lib/api'
import Button from '../../components/ui/Button.jsx'

export default function IntegrationsPage() {
  const { data: integrations, loading, error, refetch } = useApi(organizations.getIntegrations)
  
  const { mutate: createIntegration, loading: connecting } = useMutation(
    organizations.createIntegration,
    {
      onSuccess: () => {
        refetch()
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

  function handleConnect(integrationType) {
    if (integrationType === 'google-calendar') {
      // Trigger Google OAuth flow
      window.location.href = '/api/auth/google-calendar'
    } else {
      createIntegration({ type: integrationType })
    }
  }

  function handleDisconnect(integrationType) {
    deleteIntegration(integrationType)
  }

  if (loading) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Integrations</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
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
    { type: 'google-calendar', name: 'Google Calendar', description: 'Sync appointments with Google Calendar' },
    { type: 'outlook-calendar', name: 'Outlook Calendar', description: 'Sync appointments with Outlook' },
    { type: 'stripe', name: 'Stripe', description: 'Accept payments during booking' },
  ]

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Integrations</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableIntegrations.map(integration => {
          const isConnected = integrations?.some(i => i.type === integration.type && i.status === 'active')
          const isConnecting = connecting && integration.type === 'connecting'
          const isDisconnecting = disconnecting && integration.type === 'disconnecting'
          
          return (
            <div key={integration.type} className="glass rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="font-medium">{integration.name}</div>
                <div className={`px-2 py-1 rounded-full text-xs ${
                  isConnected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {isConnected ? 'Connected' : 'Not connected'}
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                {integration.description}
              </div>
              <div className="flex gap-2">
                {isConnected ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDisconnect(integration.type)}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </Button>
                ) : (
                  <Button 
                    size="sm"
                    onClick={() => handleConnect(integration.type)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? 'Connecting...' : 'Connect'}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      {integrations?.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No integrations configured yet.</p>
          <p className="text-sm">Connect your favorite tools to enhance your workflow.</p>
        </div>
      )}
    </div>
  )
}


