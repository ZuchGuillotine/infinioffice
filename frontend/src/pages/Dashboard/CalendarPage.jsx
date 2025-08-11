import { useState, useEffect } from 'react'
import { useApi } from '../../hooks/useApi'
import { organizations } from '../../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('month') // month, week, day
  
  const { 
    data: calendarData, 
    loading, 
    error, 
    refetch 
  } = useApi(organizations.getCalendarEvents)

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isToday = (date) => {
    const today = new Date()
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear()
  }

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    
    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null)
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }
    
    return days
  }

  const getEventsForDate = (date) => {
    if (!calendarData?.events || !date) return []
    
    return calendarData.events.filter(event => {
      const eventDate = new Date(event.start)
      return eventDate.getDate() === date.getDate() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getFullYear() === date.getFullYear()
    })
  }

  const navigateMonth = (direction) => {
    const newDate = new Date(selectedDate)
    newDate.setMonth(newDate.getMonth() + direction)
    setSelectedDate(newDate)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold mb-4">Calendar</h2>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-600 mb-4">
                {error.message || 'Failed to load calendar data'}
              </p>
              <Button onClick={refetch} variant="outline">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!calendarData?.events || calendarData.events.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold mb-4">Calendar</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📅</div>
              <h3 className="text-lg font-medium mb-2">No Calendar Events</h3>
              <p className="text-muted-foreground mb-4">
                {calendarData?.integrations?.length > 0 
                  ? "No events found in your connected calendars for the next 90 days."
                  : "Connect a calendar integration to view your events here."
                }
              </p>
              {calendarData?.integrations?.length === 0 && (
                <Button onClick={() => window.location.href = '/app/integrations'}>
                  Connect Calendar
                </Button>
              )}
              <Button onClick={refetch} variant="outline" className="ml-2">
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const days = getDaysInMonth(selectedDate)
  const monthName = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Calendar</h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigateMonth(-1)}
          >
            ←
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigateMonth(1)}
          >
            →
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-center">{monthName}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {days.map((date, index) => {
              const events = getEventsForDate(date)
              const isCurrentDate = isToday(date)
              
              return (
                <div 
                  key={index} 
                  className={`min-h-[100px] p-2 border border-border ${
                    isCurrentDate ? 'bg-blue-50 border-blue-200' : ''
                  } ${!date ? 'bg-gray-50' : ''}`}
                >
                  {date && (
                    <>
                      <div className={`text-sm font-medium mb-1 ${
                        isCurrentDate ? 'text-blue-600' : ''
                      }`}>
                        {date.getDate()}
                      </div>
                      
                      {/* Events for this day */}
                      <div className="space-y-1">
                        {events.slice(0, 3).map((event, eventIndex) => (
                          <div 
                            key={event.id} 
                            className="text-xs p-1 bg-blue-100 text-blue-800 rounded truncate"
                            title={`${event.summary} - ${formatTime(event.start)}`}
                          >
                            {event.summary}
                          </div>
                        ))}
                        {events.length > 3 && (
                          <div className="text-xs text-muted-foreground text-center">
                            +{events.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {calendarData.events.slice(0, 10).map(event => (
              <div key={event.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{event.summary}</h4>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(event.start)}
                    {event.location && ` • ${event.location}`}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatTime(event.start)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integration Status */}
      {calendarData.integrations && (
        <Card>
          <CardHeader>
            <CardTitle>Connected Calendars</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {calendarData.integrations.map(integration => (
                <div key={integration.type} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="capitalize">{integration.type.replace('-', ' ')}</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    integration.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {integration.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


