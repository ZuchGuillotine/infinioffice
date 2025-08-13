import { useApi } from '../../hooks/useApi'
import { organizations } from '../../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx'
import Button from '../../components/ui/Button.jsx'
import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'

export default function CalendarPage() {
  const { user } = useAuth()
  const [viewMode, setViewMode] = useState('upcoming') // upcoming, all, week
  const { data: events, loading, error, refetch } = useApi(organizations.getCalendarEvents)
  const { data: integrations } = useApi(organizations.getIntegrations)
  
  // Filter events based on view mode
  const filteredEvents = events?.events?.filter(event => {
    const eventDate = new Date(event.start)
    const now = new Date()
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    switch (viewMode) {
      case 'upcoming':
        return eventDate >= now
      case 'week':
        return eventDate >= now && eventDate <= oneWeekFromNow
      case 'all':
      default:
        return true
    }
  }) || []

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Check if user has calendar integrations
  const hasCalendarIntegrations = integrations?.some(i => 
    ['google-calendar', 'outlook-calendar', 'apple-calendar'].includes(i.type) && 
    i.status === 'active'
  )

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">Calendar</h2>
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-32"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">Calendar</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              {error.message?.includes('No active calendar integrations') ? (
                <div>
                  <div className="text-muted-foreground mb-4">
                    <span className="text-4xl mb-4 block">📅</span>
                    <h3 className="text-lg font-medium mb-2">No Calendar Integration</h3>
                    <p>Connect your calendar to view and manage your appointments.</p>
                  </div>
                  <Button onClick={() => window.location.href = '/app/integrations'}>
                    Connect Calendar
                  </Button>
                </div>
              ) : (
                <div className="text-red-600">
                  <p className="mb-2">Error loading calendar events:</p>
                  <p className="text-sm">{error.message}</p>
                  <Button onClick={refetch} variant="outline" className="mt-4">
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Calendar</h2>
          <p className="text-muted-foreground">View and manage your appointments</p>
        </div>
        <Button onClick={refetch} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* View Mode Selector */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === 'upcoming' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('upcoming')}
        >
          Upcoming
        </Button>
        <Button
          variant={viewMode === 'week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('week')}
        >
          This Week
        </Button>
        <Button
          variant={viewMode === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('all')}
        >
          All Events
        </Button>
      </div>

      {/* Calendar Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📅</span>
              <div>
                <p className="text-2xl font-bold">{events?.total || 0}</p>
                <p className="text-sm text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⏰</span>
              <div>
                <p className="text-2xl font-bold">{filteredEvents.filter(e => new Date(e.start) >= new Date()).length}</p>
                <p className="text-sm text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔗</span>
              <div>
                <p className="text-2xl font-bold">{events?.integrations?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Integrations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events List */}
      {filteredEvents.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            {viewMode === 'upcoming' ? 'Upcoming Events' : 
             viewMode === 'week' ? 'This Week\'s Events' : 
             'All Events'}
          </h3>
          <div className="space-y-3">
            {filteredEvents.map((event, index) => (
              <Card key={event.id || index} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{event.summary || 'Untitled Event'}</h4>
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          {event.source || 'calendar'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span>📅</span>
                          <span>{formatDate(event.start)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>⏰</span>
                          <span>
                            {formatTime(event.start)} 
                            {event.end && ` - ${formatTime(event.end)}`}
                          </span>
                        </div>
                        {event.isAllDay && (
                          <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                            All Day
                          </span>
                        )}
                      </div>

                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {event.description}
                        </p>
                      )}

                      {event.location && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                          <span>📍</span>
                          <span>{event.location}</span>
                        </div>
                      )}

                      {event.attendees && event.attendees.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                          <span>👥</span>
                          <span>{event.attendees.length} attendee{event.attendees.length > 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>

                    {event.htmlLink && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(event.htmlLink, '_blank')}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <span className="text-4xl mb-4 block">📅</span>
              <h3 className="text-lg font-medium mb-2">
                {viewMode === 'upcoming' ? 'No Upcoming Events' : 
                 viewMode === 'week' ? 'No Events This Week' : 
                 'No Events Found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {hasCalendarIntegrations ? 
                  'Your calendar appears to be empty for the selected time period.' :
                  'Connect your calendar to start viewing events.'
                }
              </p>
              {!hasCalendarIntegrations && (
                <Button onClick={() => window.location.href = '/app/integrations'}>
                  Connect Calendar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integration Status */}
      {events?.integrations && events.integrations.length > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span className="text-green-800 font-medium">
                Connected to {events.integrations.length} calendar integration{events.integrations.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="mt-2 text-sm text-green-700">
              {events.integrations.map(integration => integration.type).join(', ')}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


