import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../api/authApi'
import { Alert } from '../../components/feedback/Skeleton'
import { useToast } from '../../components/feedback/Toast'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../context/AuthContext'
import { AuthLayout } from '../../layouts/AuthLayout'
import { apiErrorText, fieldErrors } from '../../utils/validation'

export function ChangePasswordPage() {
  const { logout, mustChangePassword } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    const nextErrors = fieldErrors(form, {
      currentPassword: { required: true },
      newPassword: { required: true, password: true },
      confirmPassword: {
        required: true,
        test: (value, values) => (value !== values.newPassword ? 'Passwords do not match' : ''),
      },
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setLoading(true)
    setAlert('')
    try {
      await authApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      toast.success('Password updated. Sign in with the new password.')
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      setAlert(apiErrorText(error, 'Could not change password'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Change password"
      subtitle={mustChangePassword ? 'A new password is required before you can use the app.' : 'Choose a strong password (12–72 characters).'}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        {alert ? <Alert>{alert}</Alert> : null}
        <Input label="Current password" name="currentPassword" type="password" value={form.currentPassword} error={errors.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        <Input label="New password" name="newPassword" type="password" value={form.newPassword} error={errors.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        <Input label="Confirm new password" name="confirmPassword" type="password" value={form.confirmPassword} error={errors.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
        <Button type="submit" loading={loading} className="w-full">
          Update password
        </Button>
        <Button variant="outline" className="w-full" onClick={logout}>
          Logout
        </Button>
      </form>
    </AuthLayout>
  )
}
