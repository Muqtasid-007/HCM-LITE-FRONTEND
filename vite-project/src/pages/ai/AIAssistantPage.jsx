import { useState, useRef, useEffect } from 'react'
import { aiApi } from '../../api/aiApi'
import { Alert } from '../../components/feedback/Skeleton'
import { Button } from '../../components/ui/Button'
import { Card, Badge } from '../../components/ui/Card'
import { Textarea } from '../../components/ui/Input'
import { useAuth } from '../../context/AuthContext'
import { apiErrorText } from '../../utils/validation'
import { Bot, User, Send, Sparkles } from 'lucide-react'

const chips = {
  Admin: [
    'Who is on leave today?',
    'Summarize company attendance this month',
    'What is our current headcount and attrition rate?',
    'Show top late comers this month',
  ],
  HR: [
    'Who is on leave today?',
    'List late comers this month',
    'Summarize leave utilization across departments',
    'What is the current annual leave quota policy?',
  ],
  Employee: [
    'What is my leave balance for this year?',
    'Summarize my attendance for this month',
    'What are the office hours and grace period?',
    'How is medical and HRA allowance calculated?',
  ],
}

export function AIAssistantPage() {
  const { user } = useAuth()
  const prompts = chips[user?.role] || chips.Employee
  const [message, setMessage] = useState('')
  const [feed, setFeed] = useState([
    {
      role: 'assistant',
      content: `Hello! I am your read-only HR Assistant. I can help answer questions about headcount, attendance summaries, leave balances, company policies, and payroll snapshots. What would you like to know?`,
      label: 'AI-generated',
      toolsUsed: [],
    },
  ])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [feed, loading])

  async function send(text) {
    const content = (text ?? message).trim()
    if (!content || loading) return
    setMessage('')
    setFeed((current) => [...current, { role: 'user', content }])
    setLoading(true)

    try {
      const data = await aiApi.chat(content)
      setFeed((current) => [
        ...current,
        {
          role: 'assistant',
          content: data.fallback ? (data.message || data.answer) : data.answer,
          label: data.label || 'AI-generated',
          toolsUsed: data.toolsUsed || [],
          fallback: Boolean(data.fallback),
        },
      ])
    } catch (error) {
      setFeed((current) => [
        ...current,
        {
          role: 'assistant',
          content: apiErrorText(
            error,
            'The AI assistant is temporarily unavailable or your hourly rate limit (20 calls/hr) was reached. Please use the dashboard directly.',
          ),
          label: 'AI-generated',
          fallback: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-emerald-600" />
          <h1 className="text-2xl font-semibold text-slate-900">AI Assistant</h1>
        </div>
        <p className="text-sm text-slate-500">
          Powered by live read-only server analytical tools. The assistant cannot execute state mutations or approve requests. All responses are labeled AI-generated.
        </p>
      </div>

      {/* Quick Prompts Chips */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Suggested queries</p>
        <div className="flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={loading}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-900 transition-colors shadow-sm disabled:opacity-50"
              onClick={() => send(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Feed */}
      <Card className="min-h-[50vh] max-h-[62vh] overflow-y-auto space-y-4 p-4">
        {feed.map((item, index) => {
          const isUser = item.role === 'user'
          return (
            <div key={index} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser ? (
                <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bot size={18} />
                </div>
              ) : null}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  isUser
                    ? 'bg-slate-900 text-white rounded-tr-none'
                    : 'bg-slate-50 text-slate-900 border border-slate-200 rounded-tl-none'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-semibold text-xs tracking-wide">
                    {isUser ? 'You' : 'Assistant'}
                  </span>
                  {!isUser && item.label ? (
                    <Badge tone="sky" className="text-[10px] py-0 px-1.5 font-normal">
                      {item.label}
                    </Badge>
                  ) : null}
                </div>

                <p className="whitespace-pre-wrap leading-relaxed text-sm">{item.content}</p>

                {!isUser && item.toolsUsed?.length ? (
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-medium text-[11px]">Tools queried:</span>
                    {item.toolsUsed.map((tool) => (
                      <span key={tool} className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                        {tool}
                      </span>
                    ))}
                  </div>
                ) : null}

                {!isUser && item.fallback ? (
                  <Alert tone="amber" className="mt-2 text-xs py-1.5">
                    Fallback mode: provider was unavailable or rate-limited. Results reflect server fallbacks.
                  </Alert>
                ) : null}
              </div>

              {isUser ? (
                <div className="h-8 w-8 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center shrink-0">
                  <User size={18} />
                </div>
              ) : null}
            </div>
          )
        })}

        {loading ? (
          <div className="flex gap-3 items-center text-slate-400 text-xs py-2">
            <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 animate-pulse">
              <Bot size={18} />
            </div>
            <span>Consulting analytical tools...</span>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </Card>

      {/* Input Box */}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
      >
        <Textarea
          value={message}
          rows={2}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about employees, leave balances, attendance, or payroll (Press Enter to send)..."
          className="resize-none"
        />
        <Button type="submit" loading={loading} disabled={!message.trim()} className="self-end px-5 py-2.5">
          <Send size={16} className="mr-1.5" />
          Send
        </Button>
      </form>
    </div>
  )
}
