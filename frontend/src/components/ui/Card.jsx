import { clsx } from 'clsx'

export function Card({ className, children, ...props }) {
  return (
    <div 
      className={clsx(
        "glass rounded-lg border border-border/20 bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }) {
  return (
    <div className={clsx("flex flex-col space-y-1.5 p-6", className)}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children }) {
  return (
    <h3 className={clsx("text-2xl font-semibold leading-none tracking-tight", className)}>
      {children}
    </h3>
  )
}

export function CardDescription({ className, children }) {
  return (
    <p className={clsx("text-sm text-muted-foreground", className)}>
      {children}
    </p>
  )
}

export function CardContent({ className, children }) {
  return (
    <div className={clsx("p-6 pt-0", className)}>
      {children}
    </div>
  )
}