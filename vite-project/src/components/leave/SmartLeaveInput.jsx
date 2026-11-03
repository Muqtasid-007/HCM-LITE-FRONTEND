import { useState } from 'react'
import { aiApi } from '../../api/aiApi'
import { useToast } from '../feedback/Toast'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Input'
import { Alert } from '../feedback/Skeleton'
import { apiErrorText } from '../../utils/validation'

export function SmartLeaveInput({ onProposal }) {
  const toast = useToast()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [fallback, setFallback] = useState('')

  async function parse() {
    if (!message.trim()) return
    setLoading(true)
    setFallback('')
    try {
      const data = await aiApi.smartLeave(message.trim())
      if (data?.fallback) {
        setFallback(data.message || 'Please complete the leave form manually.')
        return
      }
      toast.success('AI-generated proposal ready for review')
      onProposal?.(data.proposal)
    } catch (error) {
      setFallback(apiErrorText(error, 'Could not parse leave request'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-3">
      <p className="text-sm font-medium text-emerald-900">Smart leave (AI-generated, not submitted)</p>
      <Textarea
        name="smartLeave"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder='e.g. "Annual leave from 2026-11-02 to 2026-11-04 for a family event"'
      />
      <Button variant="outline" loading={loading} onClick={parse}>
        Parse with AI
      </Button>
      {fallback ? <Alert tone="amber">{fallback}</Alert> : null}
    </div>
  )
}
