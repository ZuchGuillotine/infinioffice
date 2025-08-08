import { clsx } from 'clsx'

export default function Button({ as: Comp = 'button', variant = 'primary', size = 'md', className, ...props }) {
  const base = 'inline-flex items-center justify-center rounded-md font-medium transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background active:scale-[0.98]';
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:opacity-95 shadow-sm hover:shadow-md',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm',
    ghost: 'bg-transparent hover:bg-white/10',
    outline: 'border border-border hover:bg-white/5',
    glass: 'glass text-foreground hover:bg-white/10',
    gradient: 'text-white bg-gradient-to-r from-primary via-accent to-sky-400 hover:shadow-lg hover:shadow-primary/25',
  }
  const sizes = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4',
    lg: 'h-11 px-6 text-lg',
    xl: 'h-12 px-8 text-lg',
  }
  return <Comp className={clsx(base, variants[variant], sizes[size], className)} {...props} />
}


