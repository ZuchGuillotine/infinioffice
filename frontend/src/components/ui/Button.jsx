import clsx from 'clsx'

export default function Button({ as: Comp = 'button', variant = 'primary', size = 'md', className, ...props }) {
  const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background'
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:opacity-90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'bg-transparent hover:bg-white/10',
    outline: 'border border-border hover:bg-white/5',
  }
  const sizes = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4',
    lg: 'h-11 px-6 text-lg',
  }
  return <Comp className={clsx(base, variants[variant], sizes[size], className)} {...props} />
}


