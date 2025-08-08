import Input from '../../../components/ui/Input.jsx'
import Button from '../../../components/ui/Button.jsx'

export default function BusinessInfoEditor() {
  return (
    <form className="grid md:grid-cols-2 gap-4 max-w-3xl">
      <div>
        <label className="block text-sm mb-1">Business Name</label>
        <Input placeholder="Acme HVAC" />
      </div>
      <div>
        <label className="block text-sm mb-1">Timezone</label>
        <Input placeholder="America/New_York" />
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm mb-1">Address</label>
        <Input placeholder="123 Main St, Springfield" />
      </div>
      <div>
        <label className="block text-sm mb-1">Escalation Number (optional)</label>
        <Input placeholder="+1 (555) 000-0000" />
      </div>
      <div className="md:col-span-2 flex justify-end pt-2">
        <Button>Save</Button>
      </div>
    </form>
  )
}


