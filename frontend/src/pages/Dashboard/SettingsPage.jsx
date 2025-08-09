import { useState, useEffect } from 'react'
import { useApi, useMutation } from '../../hooks/useApi'
import { user } from '../../lib/api'
import Input from '../../components/ui/Input.jsx'
import Button from '../../components/ui/Button.jsx'

export default function SettingsPage() {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    password: ''
  })
  const [passwordChange, setPasswordChange] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const { data: userProfile, loading, error, refetch } = useApi(user.getProfile)
  
  const { mutate: updateProfile, loading: saving } = useMutation(
    user.updateProfile,
    {
      onSuccess: () => {
        refetch()
        setProfile(prev => ({ ...prev, password: '' }))
      }
    }
  )

  useEffect(() => {
    if (userProfile) {
      setProfile({
        name: userProfile.name || '',
        email: userProfile.email || '',
        password: ''
      })
    }
  }, [userProfile])

  function handleSubmit(e) {
    e.preventDefault()
    
    const updateData = {
      name: profile.name,
      email: profile.email
    }

    // Only include password if it's being changed
    if (profile.password) {
      updateData.password = profile.password
    }

    updateProfile(updateData)
  }

  function updateField(field, value) {
    setProfile(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <h2 className="text-xl font-semibold">User Settings</h2>
        <div className="animate-pulse space-y-4">
          <div>
            <div className="h-4 bg-gray-200 rounded w-20 mb-1"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
          <div>
            <div className="h-4 bg-gray-200 rounded w-16 mb-1"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
          <div>
            <div className="h-4 bg-gray-200 rounded w-20 mb-1"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
          <div className="text-right">
            <div className="h-10 w-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-xl font-semibold mb-4">User Settings</h2>
        <div className="text-red-600 p-4 border border-red-200 rounded-md">
          Error loading profile: {error.message}
          <Button onClick={refetch} variant="outline" className="ml-2">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">User Settings</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Full Name</label>
          <Input 
            value={profile.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Jane Doe" 
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Email</label>
          <Input 
            type="email" 
            value={profile.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="jane@example.com" 
          />
        </div>
        
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium mb-3">Change Password</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">New Password (leave blank to keep current)</label>
              <Input 
                type="password" 
                value={profile.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder="••••••••" 
              />
              {profile.password && (
                <div className="text-xs text-muted-foreground mt-1">
                  Password should be at least 8 characters long
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-right pt-4">
          <Button type="submit" disabled={saving || !profile.name || !profile.email}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
      
      {userProfile && (
        <div className="border-t pt-4 text-sm text-muted-foreground">
          <p>Account created: {new Date(userProfile.createdAt).toLocaleDateString()}</p>
          {userProfile.lastLogin && (
            <p>Last login: {new Date(userProfile.lastLogin).toLocaleDateString()}</p>
          )}
        </div>
      )}
    </div>
  )
}


