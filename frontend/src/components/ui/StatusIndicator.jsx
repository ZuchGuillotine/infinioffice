import { clsx } from 'clsx'

export default function StatusIndicator({ status = 'online', latency, className }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'processing': return 'bg-yellow-500'
      case 'offline': return 'bg-red-500'
      case 'connecting': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'online': return 'Agent Online'
      case 'processing': return 'Processing Call'
      case 'offline': return 'Agent Offline'
      case 'connecting': return 'Connecting...'
      default: return 'Unknown'
    }
  }

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <div className="relative">
        <div className={clsx("w-2 h-2 rounded-full", getStatusColor(status))} />
        <div className={clsx(
          "absolute inset-0 w-2 h-2 rounded-full animate-ping",
          getStatusColor(status),
          status === 'online' && 'opacity-75'
        )} />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium">{getStatusText(status)}</span>
        {latency && (
          <span className="text-xs text-muted-foreground">
            {latency}ms latency
          </span>
        )}
      </div>
    </div>
  )
}