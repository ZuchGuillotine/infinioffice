import { Card, CardContent } from './Card.jsx'
import { clsx } from 'clsx'

export default function MetricCard({ 
  title, 
  value, 
  subvalue, 
  trend, 
  icon, 
  variant = 'default',
  className,
  children 
}) {
  const variants = {
    default: 'border-border/50',
    success: 'border-green-500/30 bg-green-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    error: 'border-red-500/30 bg-red-500/5',
    info: 'border-blue-500/30 bg-blue-500/5'
  }

  const getTrendColor = (trend) => {
    if (!trend) return 'text-muted-foreground'
    return trend > 0 ? 'text-green-500' : 'text-red-500'
  }

  const getTrendIcon = (trend) => {
    if (!trend) return null
    return trend > 0 ? '↗' : '↘'
  }

  return (
    <Card className={clsx(
      'relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5',
      variants[variant],
      className
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {icon && <div className="text-primary/80">{icon}</div>}
              <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-foreground">{value}</div>
              {trend !== undefined && (
                <div className={clsx("text-sm font-medium flex items-center", getTrendColor(trend))}>
                  <span className="mr-1">{getTrendIcon(trend)}</span>
                  {Math.abs(trend)}%
                </div>
              )}
            </div>
            {subvalue && (
              <p className="text-sm text-muted-foreground mt-1">{subvalue}</p>
            )}
            {children && (
              <div className="mt-4">{children}</div>
            )}
          </div>
        </div>
        
        {/* Subtle glow effect for primary cards */}
        {variant !== 'default' && (
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-transparent via-current to-transparent opacity-5" />
        )}
      </CardContent>
    </Card>
  )
}