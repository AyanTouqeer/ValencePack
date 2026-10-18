import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import Atom from './Atom.jsx'

// Bottom "Chat with AI" widget — ported from the vanilla chat-bar IIFE + sendChat().
// Talks to POST /api/chat with the current assessment as contextData, renders source-id
// citations as links, shows a typing indicator, and can be told (from the what-if panel)
// to announce a change and open itself.

const SUGGESTIONS = [
  'Why was glass excluded?',
  'Explain the ranking: why is this option first?',
  'What does PPWR Article 6 require for recyclability?',
  'How can I reduce packaging cost without losing recyclability?',
]

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function renderCitations(answer, srcById) {
  if (answer.startsWith('missing:')) {
    const id = answer.replace('missing:', '').trim()
    return `<strong>⚠️ Insufficient evidence.</strong> Source <span class="cite">${escapeHtml(id)}</span> not yet collected.`
  }
  if (answer.includes('unavailable') || answer.includes('Offline')) return `<em>${escapeHtml(answer)}</em>`
  return escapeHtml(answer).replace(/([A-Z]+(?:-[A-Z]+)+)/g, (m) => {
    const s = srcById[m]
    if (s && s.url) return `<a class="cite" href="${s.url}" target="_blank" rel="noopener">${m}</a>`
    return `<span class="cite">${m}</span>`
  })
}

const ChatWidget = forwardRef(function ChatWidget({ contextData }, ref) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([]) // {role, html?} — assistant html is pre-rendered citations
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sugVisible, setSugVisible] = useState(false)
  const histRef = useRef(null)
  const inputRef = useRef(null)

  const srcById = Object.fromEntries(((contextData && contextData.sources) || []).map((s) => [s.id, s]))

  const scrollDown = () => { const h = histRef.current; if (h) h.scrollTop = h.scrollHeight }
  useEffect(scrollDown, [messages, sending])

  async function sendChat(questionText) {
    const question = (questionText ?? input).trim()
    if (!question || sending) return
    setSugVisible(false)
    setMessages((m) => [...m, { role: 'user', text: question }])
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, contextData: contextData || {} }),
      })
      const data = await res.json().catch(() => ({}))
      // Backend may 500 when the AI provider isn't configured — answer honestly, don't fake a reply.
      const answer = res.ok ? (data.answer || 'No response.')
        : ((data.error && data.error.join ? data.error.join('; ') : null) || 'The assistant is unavailable right now.')
      const cls = 'chat-bubble assistant' + (answer.startsWith('missing:') ? ' refusal' : '')
      setMessages((m) => [...m, { role: 'assistant', cls, html: renderCitations(answer, srcById) }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', cls: 'chat-bubble assistant refusal', text: 'Network error.' }])
    } finally {
      setSending(false)
    }
  }

  // Imperative API used by the what-if panel to announce changes and open the chat.
  useImperativeHandle(ref, () => ({
    open() { setOpen(true) },
    notifyAssistant(text) {
      setMessages((m) => [...m, { role: 'assistant', cls: 'chat-bubble assistant', text }])
      setOpen(true)
    },
  }), [])

  // Collapse when a click lands outside the chat bar (parity with vanilla).
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!e.target.closest('.chat-bar')) setOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [open])

  const headKeyDown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) } }

  return (
    <div className={'chat-bar' + (open ? ' open' : '')} id="chat-bar">
      <div className="chat-bar-inner">
        <div className="chat-head" id="chat-head" role="button" tabIndex={0} aria-expanded={open} aria-label="Chat with AI" onClick={() => setOpen((o) => !o)} onKeyDown={headKeyDown}>
          <svg className="chat-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" /></svg>
          <span className="chat-title">Chat with AI</span>
          <span className="chat-chev">&#9662;</span>
        </div>

        <div className={'chat-history' + (messages.length ? ' visible' : '')} id="chat-history" ref={histRef}>
          {messages.map((m, i) => m.html != null
            ? <div key={i} className={m.cls} dangerouslySetInnerHTML={{ __html: m.html }} />
            : <div key={i} className={m.cls || ('chat-bubble ' + m.role)}>{m.text}</div>)}
          {sending && (
            <div className="chat-bubble assistant typing"><Atom /></div>
          )}
        </div>

        <div className={'chat-suggestions' + (sugVisible && !messages.length ? ' visible' : '')} id="chat-suggestions">
          {SUGGESTIONS.map((q, i) => (
            <span key={i} className="sug" data-q={q} onMouseDown={(e) => { e.preventDefault(); sendChat(q) }}>{q}</span>
          ))}
        </div>

        <div className="chat-input-row">
          <input
            type="text" id="chat-input" ref={inputRef} placeholder="Ask Vpack about your results..." autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => { if (!messages.length) setSugVisible(true) }}
            onBlur={() => setTimeout(() => setSugVisible(false), 200)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
          />
          <button className="attach-btn" id="attach-btn" type="button" title="Upload file (coming soon)" aria-label="Attach file" onClick={() => alert('File upload coming soon.')}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
          </button>
          <button className={'chat-send' + (sending ? ' loading' : '')} id="chat-send" type="button" aria-label="Send" disabled={sending} onClick={() => sendChat()}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
})

export default ChatWidget
