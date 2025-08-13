import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Button from '../components/ui/Button.jsx'
import { Card, CardContent } from '../components/ui/Card.jsx'
import AnimatedBackground from '../components/ui/AnimatedBackground.jsx'
import AudioVisualization from '../components/ui/AudioVisualization.jsx'
import StatusIndicator from '../components/ui/StatusIndicator.jsx'

export default function LandingPage() {
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [currentFeature, setCurrentFeature] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature(prev => (prev + 1) % features.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-background to-secondary/20">
      <AnimatedBackground />
      <GradientOrbs />
      <div className="noise-overlay" />
      
      <nav className="container mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25" />
            <div className="absolute inset-0 h-8 w-8 rounded-lg bg-primary animate-pulse opacity-20" />
          </div>
          <span className="font-bold text-xl tracking-wide bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            InfiniOffice
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/pricing">
            <Button variant="ghost" className="hover:bg-primary/10">Pricing</Button>
          </Link>
          <Link to="/auth/login">
            <Button variant="ghost" className="hover:bg-primary/10">
              Sign In
            </Button>
          </Link>
          <Link to="/auth/register">
            <Button variant="gradient" className="transition-all duration-300">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      <header className="container mx-auto px-6 pt-16 pb-20 text-center relative z-10">
        <div className="mb-8">
          <StatusIndicator status="online" latency="890" className="justify-center mb-6 opacity-80" />
        </div>
        
        <h1 className="text-6xl md:text-7xl lg:text-8xl font-black neon tracking-tight mb-8 leading-none">
          <span className="block bg-gradient-to-r from-white via-primary to-accent bg-clip-text text-transparent">
            AI Voice
          </span>
          <span className="block bg-gradient-to-r from-accent via-primary to-white bg-clip-text text-transparent">
            That Works
          </span>
        </h1>
        
        <div className="max-w-3xl mx-auto mb-12">
          <p className="text-xl text-muted-foreground mb-6 leading-relaxed">
            Transform your after-hours calls into booked appointments.
            <br />
            <span className="text-primary font-semibold">AI agents that sound human.</span>
            <span className="text-accent font-semibold"> Results that drive revenue.</span>
          </p>
          <div className="mx-auto w-40 h-40 rounded-full voice-gradient animate-float gradient-ring mb-6 flex items-center justify-center">
            <AudioVisualization isActive={true} height="h-12" barCount={18} />
          </div>
          
          <div className="flex items-center justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">85%+</div>
              <div className="text-sm text-muted-foreground">Booking Success</div>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">1.2s</div>
              <div className="text-sm text-muted-foreground">Avg Response</div>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">24/7</div>
              <div className="text-sm text-muted-foreground">Always On</div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link to="/auth/register">
            <Button size="xl" variant="gradient" className="text-lg px-8 py-4 hover:shadow-xl hover:shadow-primary/30 transition-all duration-500 transform hover:scale-105">
              Start Free Trial →
            </Button>
          </Link>
          <button 
            onClick={() => setIsAudioPlaying(!isAudioPlaying)}
            className="flex items-center gap-3 px-6 py-4 rounded-lg border border-primary/30 hover:border-primary hover:bg-primary/5 transition-all duration-300"
          >
            <AudioVisualization isActive={isAudioPlaying} height="h-6" barCount={8} />
            <span className="text-primary font-medium">
              {isAudioPlaying ? 'Stop' : 'Hear'} AI Demo
            </span>
          </button>
        </div>

        <div className="text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            🚀 Join 500+ businesses already using InfiniOffice
          </span>
        </div>
      </header>

      <section id="features" className="container mx-auto px-6 py-20 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Built for Real Business
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Every feature designed for maximum revenue capture and minimal setup time
          </p>
        </div>
        
        <div className="grid lg:grid-cols-3 gap-8 mb-20">
          {features.map((feature, index) => (
            <FeatureCard 
              key={feature.title} 
              feature={feature} 
              isActive={index === currentFeature}
              delay={index * 100}
            />
          ))}
        </div>

        <ConversionProof />
      </section>

      <footer className="container mx-auto px-6 py-12 text-center text-muted-foreground border-t border-border/20">
        <div className="flex items-center justify-center gap-8 mb-4">
          <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
          <a href="mailto:delicacybydesign@gmail.com" className="hover:text-primary transition-colors">Support</a>
        </div>
        <p>© {new Date().getFullYear()} InfiniOffice LLC. Built for the future of business communication.</p>
      </footer>
    </div>
  )
}

function GradientOrbs() {
  return (
    <>
      <div className="absolute top-20 left-20 w-96 h-96 rounded-full blur-3xl opacity-20 bg-gradient-radial from-primary via-transparent to-transparent animate-pulse" />
      <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full blur-3xl opacity-15 bg-gradient-radial from-accent via-transparent to-transparent animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-10 bg-gradient-radial from-primary via-accent to-transparent" />
    </>
  )
}

function FeatureCard({ feature, isActive, delay = 0 }) {
  return (
    <Card className={`group transition-all duration-700 hover:shadow-2xl hover:shadow-primary/10 border-border/30 hover:border-primary/50 transform hover:scale-105 ${
      isActive ? 'ring-1 ring-primary/30 shadow-lg shadow-primary/5' : ''
    }`}>
      <CardContent className="p-8 text-center">
        <div className="relative mb-6">
          <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
            {feature.icon}
          </div>
          <div className={`absolute inset-0 -z-10 rounded-full blur-xl opacity-20 bg-primary group-hover:opacity-40 transition-opacity duration-500`} />
        </div>
        <h3 className="text-2xl font-bold mb-4 text-foreground group-hover:text-primary transition-colors">
          {feature.title}
        </h3>
        <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
        <div className="mt-6 pt-4 border-t border-border/20">
          <span className="text-primary font-semibold text-sm">{feature.benefit}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function ConversionProof() {
  return (
    <div className="relative">
      <div className="glass rounded-2xl p-8 border border-primary/20">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold mb-2">Trusted by Growing Businesses</h3>
          <p className="text-muted-foreground">Real results from real companies</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center p-6 rounded-lg bg-background/50">
            <div className="text-3xl font-bold text-green-500 mb-2">150%</div>
            <div className="text-sm text-muted-foreground">Revenue Increase</div>
            <div className="text-xs text-muted-foreground mt-1">HVAC Company, Denver</div>
          </div>
          <div className="text-center p-6 rounded-lg bg-background/50">
            <div className="text-3xl font-bold text-blue-500 mb-2">92%</div>
            <div className="text-sm text-muted-foreground">Booking Success</div>
            <div className="text-xs text-muted-foreground mt-1">Dental Practice, Austin</div>
          </div>
          <div className="text-center p-6 rounded-lg bg-background/50">
            <div className="text-3xl font-bold text-purple-500 mb-2">24/7</div>
            <div className="text-sm text-muted-foreground">Never Miss a Call</div>
            <div className="text-xs text-muted-foreground mt-1">Auto Repair, Phoenix</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const features = [
  { 
    title: 'Natural Voice AI', 
    desc: 'Advanced STT-LLM-TTS pipeline with sub-second response times. Conversations so natural, customers forget they\'re talking to AI.',
    icon: '🤖',
    benefit: 'Human-like interactions'
  },
  { 
    title: 'Smart Scheduling', 
    desc: 'Automatically sync with Google Calendar and Outlook. Handle conflicts, buffer times, and booking preferences with zero manual work.',
    icon: '📅',
    benefit: 'Zero-conflict bookings'
  },
  { 
    title: 'Revenue Capture', 
    desc: 'Turn every missed call into revenue. After-hours booking, appointment reminders, and intelligent escalation when needed.',
    icon: '💰',
    benefit: 'Never miss revenue again'
  }
]