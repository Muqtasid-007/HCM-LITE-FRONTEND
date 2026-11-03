import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Alert } from '../../components/feedback/Skeleton'
import { useToast } from '../../components/feedback/Toast'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../context/AuthContext'
import { AuthLayout } from '../../layouts/AuthLayout'
import { apiErrorText, fieldErrors } from '../../utils/validation'

export function LoginPage() {
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    const nextErrors = fieldErrors(form, {
      email: { required: true, email: true },
      password: { required: true },
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setLoading(true)
    setAlert('')
    try {
      const data = await login(form.email.trim(), form.password)
      toast.success('Signed in')
      if (data.user?.mustChangePassword) navigate('/change-password', { replace: true })
      else navigate(location.state?.from || '/dashboard', { replace: true })
    } catch (error) {
      setAlert(error.status === 401 ? 'Invalid credentials' : apiErrorText(error, 'Unable to sign in'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Sign in" subtitle="Use your issued email and password.">
      <form className="space-y-4" onSubmit={onSubmit}>
        {alert ? <Alert>{alert}</Alert> : null}
        <Input label="Email" name="email" type="email" autoComplete="username" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Password" name="password" type="password" autoComplete="current-password" value={form.password} error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
