export default function IntegrationsPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Integrations</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { name: 'Google Calendar', status: 'Not connected' },
          { name: 'Outlook Calendar', status: 'Not connected' },
          { name: 'Stripe', status: 'Not connected' },
        ].map(i => (
          <div key={i.name} className="glass rounded-lg p-4">
            <div className="font-medium">{i.name}</div>
            <div className="text-sm text-muted-foreground">{i.status}</div>
          </div>
        ))}
      </div>
    </div>
  )
}


