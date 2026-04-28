'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage } from '@/lib/types'

interface Props {
  initialHistory: ChatMessage[]
  referenceImages: string[]
  onComplete: (history: ChatMessage[], images: string[]) => void
}

interface UIMessage {
  role: 'user' | 'model'
  content: string
  imageUrls?: string[]
}

export default function BrandChat({ initialHistory, referenceImages: initialImages, onComplete }: Props) {
  const [messages, setMessages] = useState<UIMessage[]>(() => {
    const msgs: UIMessage[] = initialHistory.map((m) => ({ role: m.role, content: m.content }))
    if (msgs.length === 0) {
      msgs.push({
        role: 'model',
        content: "Hey! I'm Brand, your brand strategist. I'm here to help you build a complete brand identity profile — so your content always looks, sounds, and feels like *you*.\n\nLet's start simple: **What's the name of your business, and what do you do?**",
      })
    }
    return msgs
  })

  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [referenceImages, setReferenceImages] = useState<string[]>(initialImages)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  // Autosave — POST current chat state to /api/brand-brief so refreshes restore it
  const autosave = useCallback(async (history: ChatMessage[], images: string[]) => {
    try {
      await fetch('/api/brand-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_history: history,
          reference_images: images,
          chat_completed: false,
        }),
      })
    } catch {
      // non-fatal — don't block the chat if save fails
    }
  }, [])

  const send = useCallback(async (text: string, uploadedUrls?: string[]) => {
    const userText = text.trim()
    if (!userText && !uploadedUrls?.length) return
    setError('')

    const userMsg: UIMessage = {
      role: 'user',
      content: userText || '(uploaded reference images)',
      imageUrls: uploadedUrls,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    // Build history from current messages (excluding the streaming placeholder)
    const history: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }))

    // Add model streaming placeholder
    setMessages((prev) => [...prev, { role: 'model', content: '' }])

    try {
      const res = await fetch('/api/brand-brief/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText || `I've uploaded ${uploadedUrls?.length} reference image(s) for my brand visual style.`,
          history,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Chat failed')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullResponse += chunk
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { role: 'model', content: fullResponse }
          return next
        })
      }

      // Build the new full history (used for both autosave + completion check)
      const newHistory: ChatMessage[] = [
        ...history,
        { role: 'user', content: userMsg.content },
        { role: 'model', content: fullResponse },
      ]

      // ⚡ Autosave to DB so refresh restores the conversation
      autosave(newHistory, referenceImages)

      // Check if the model signalled completion
      if (fullResponse.includes('"action":"BRIEF_COMPLETE"')) {
        const cleanResponse = fullResponse
          .replace(/```json[\s\S]*?```/g, '')
          .trim()

        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { role: 'model', content: cleanResponse }
          return next
        })

        // Replace the model message in history with the cleaned version
        const finalHistory: ChatMessage[] = [
          ...history,
          { role: 'user', content: userMsg.content },
          { role: 'model', content: cleanResponse },
        ]
        setGenerating(true)
        onComplete(finalHistory, referenceImages)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setMessages((prev) => prev.slice(0, -1)) // remove empty placeholder
    } finally {
      setStreaming(false)
    }
  }, [messages, referenceImages, onComplete, autosave])

  // Manual "I'm done — generate my brief" trigger.
  // Safety net for when the bot doesn't emit BRIEF_COMPLETE on its own.
  const finishManually = useCallback(() => {
    const history: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }))
    if (history.length < 4) {
      setError('Please answer at least a couple of questions before finishing.')
      return
    }
    setGenerating(true)
    onComplete(history, referenceImages)
  }, [messages, referenceImages, onComplete])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!streaming && input.trim()) send(input)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    setError('')

    // Client-side guard — block videos and oversize files before sending.
    // Server-side allowlist (lib/upload route) is the source of truth, this is just UX.
    const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    const MAX_BYTES = 10 * 1024 * 1024 // 10MB — must match server

    const valid: File[] = []
    for (const file of files) {
      if (file.type.startsWith('video/')) {
        setError(`"${file.name}" is a video — only images are allowed (JPG, PNG, WebP, GIF, SVG).`)
        continue
      }
      if (!ALLOWED_MIME.includes(file.type)) {
        setError(`"${file.name}" is not a supported image format. Use JPG, PNG, WebP, GIF, or SVG.`)
        continue
      }
      if (file.size > MAX_BYTES) {
        setError(`"${file.name}" is too large (max 10MB).`)
        continue
      }
      valid.push(file)
    }

    if (!valid.length) {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    // Upload to Supabase Storage (Content/brand-refs/{user_id}/...) — returns public URLs
    const uploaded: string[] = []
    for (const file of valid) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch('/api/brand-brief/upload', { method: 'POST', body: fd })
        if (res.ok) {
          const { url } = await res.json()
          uploaded.push(url)
        } else {
          const { error } = await res.json()
          setError(error ?? 'Upload failed')
        }
      } catch {
        setError('Upload failed')
      }
    }

    if (uploaded.length) {
      const next = [...referenceImages, ...uploaded]
      setReferenceImages(next)

      // ⚡ Immediately persist the new image URLs to DB so they survive a refresh
      // even if the user never sends a follow-up message. Don't await — non-blocking.
      autosave(messages.map((m) => ({ role: m.role, content: m.content })), next)

      // Send a chat message acknowledging the upload (passes fresh array to autosave inside send)
      await send('', uploaded)
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeReferenceImage = useCallback((index: number) => {
    const next = referenceImages.filter((_, i) => i !== index)
    setReferenceImages(next)
    // Persist removal immediately
    autosave(messages.map((m) => ({ role: m.role, content: m.content })), next)
  }, [referenceImages, messages, autosave])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 mr-2">
                B
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[var(--accent)] text-white rounded-br-sm'
                  : 'bg-[var(--surface)] text-[var(--foreground)] rounded-bl-sm border border-[var(--border)]'
              }`}
            >
              {/* Render **bold** text */}
              {msg.content
                ? msg.content.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                    part.startsWith('**') && part.endsWith('**')
                      ? <strong key={j}>{part.slice(2, -2)}</strong>
                      : part
                  )
                : <span className="opacity-40">●●●</span>
              }
              {msg.imageUrls?.map((url, j) => (
                <img key={j} src={url} alt="Reference" className="mt-2 rounded-lg max-h-40 object-cover border border-white/10" />
              ))}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-[var(--muted)] flex items-center justify-center text-[var(--foreground)] text-xs font-bold shrink-0 mt-1 ml-2">
                You
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reference image thumbnails — saved to Supabase Storage, persisted to DB */}
      {referenceImages.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap items-center">
          <span className="text-xs text-[var(--muted-foreground)]">
            {referenceImages.length} reference {referenceImages.length === 1 ? 'image' : 'images'} saved
          </span>
          {referenceImages.map((url, i) => (
            <div key={i} className="relative group">
              <img src={url} alt={`ref-${i}`} className="h-12 w-12 rounded-lg object-cover border border-[var(--border)]" />
              <button
                onClick={() => removeReferenceImage(i)}
                disabled={streaming || generating}
                aria-label="Remove image"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Manual "Done" button — appears once the chat has enough exchanges.
          Safety net if the AI never emits BRIEF_COMPLETE. */}
      {!generating && !streaming && messages.filter((m) => m.role === 'user').length >= 3 && (
        <div className="px-4 pb-2 flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--muted-foreground)]">
            Done answering? Generate your brand brief from what you've shared so far.
          </p>
          <button
            onClick={finishManually}
            className="text-xs font-medium bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition shrink-0"
          >
            ✨ Generate brief
          </button>
        </div>
      )}

      {error && (
        <p className="px-4 pb-2 text-sm text-red-500">{error}</p>
      )}

      {generating && (
        <div className="px-4 pb-3 text-sm text-[var(--muted-foreground)] flex items-center gap-2">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Generating your brand brief…
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-[var(--border)] px-4 py-3 flex items-end gap-2">
        {/* Image upload */}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={streaming || uploading || generating}
          className="p-2 rounded-xl border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors disabled:opacity-40 shrink-0"
          title="Upload reference images"
        >
          {uploading ? (
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </button>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={streaming ? 'Brand is typing…' : 'Type your answer…'}
          disabled={streaming || generating}
          className="flex-1 resize-none bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition disabled:opacity-40"
        />

        {/* Send */}
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || streaming || generating}
          className="p-2.5 rounded-xl bg-[var(--accent)] text-white disabled:opacity-40 hover:opacity-90 transition shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
