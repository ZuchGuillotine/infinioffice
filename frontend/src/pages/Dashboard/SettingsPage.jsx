import Input from '../../components/ui/Input.jsx'
import Button from '../../components/ui/Button.jsx'

export default function SettingsPage() {
  return (
    <form className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold">User Settings</h2>
      <div>
        <label className="block text-sm mb-1">Full Name</label>
        <Input placeholder="Jane Doe" />
      </div>
      <div>
        <label className="block text-sm mb-1">Email</label>
        <Input type="email" placeholder="jane@example.com" />
      </div>
      <div>
        <label className="block text-sm mb-1">Password</label>
        <Input type="password" placeholder="••••••••" />
      </div>
      <div className="text-right">
        <Button>Save</Button>
      </div>
    </form>
  )
}


