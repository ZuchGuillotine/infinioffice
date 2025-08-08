import { clsx } from 'clsx'
import AudioVisualization from './AudioVisualization.jsx'

export default function CallStatus({ 
  phone, 
  duration, 
  status = 'connecting',
  className 
}) {
  const statusConfig = {
    connecting: {
      color: 'border-blue-500 bg-blue-500/10',
      icon: '📞',
      label: 'Connecting...'
    },
    active: {
      color: 'border-green-500 bg-green-500/10', 
      icon: '🟢',
      label: 'Live Call'
    },
    ended: {
      color: 'border-gray-500 bg-gray-500/10',
      icon: '📞',
      label: 'Call Ended'
    },
    failed: {
      color: 'border-red-500 bg-red-500/10',
      icon: '❌', 
      label: 'Call Failed'
    }
  }

  const config = statusConfig[status] || statusConfig.connecting

  return (
    <div className={clsx(
      "flex items-center gap-4 p-4 rounded-lg border transition-all duration-300",
      config.color,
      className
    )}>
      <div className="flex items-center gap-3">
        <span className="text-xl">{config.icon}</span>
        <div>
          <p className="font-medium">{config.label}</p>
          <p className="text-sm text-muted-foreground">
            {phone} {duration && `• ${duration}`}
          </p>
        </div>
      </div>
      
      {status === 'active' && (
        <div className="ml-auto">
          <AudioVisualization isActive={true} height="h-6" barCount={12} />
        </div>
      )}
    </div>
  )
}