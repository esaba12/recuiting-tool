import { useState, useRef } from 'react'
import { Image as ImageIcon, X } from 'lucide-react'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'
import { createEvent as createCalendarEvent, addOneHour } from '../googleCalendar.js'
import { claudeJSON, CLAUDE_MODELS } from '../lib/claude.js'

const MAX_DIM = 1568 // Anthropic's documented vision token-efficiency sweet spot

function downscaleImage(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(fileOrBlob)
    img.onload = () => {
      let { width, height } = img
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = url
  })
}

async function extractCalendarEvent({ text, imageBase64 }) {
  const content = []
  if (imageBase64) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } })
  content.push({
    type: 'text',
    text: `Extract calendar event details from ${imageBase64 ? 'this screenshot' : 'this text'}${text && imageBase64 ? ', using the accompanying text for extra context' : ''}. Return ONLY valid JSON, no explanation, no markdown.

{
  "title": "event title",
  "date": "YYYY-MM-DD",
  "start_time": "HH:MM in 24-hour format, or null if all-day/unspecified",
  "end_time": "HH:MM in 24-hour format, or null",
  "location": "location, address, or meeting link — or null",
  "description": "brief context/notes — or null"
}

${text ? `Text:\n${text}` : ''}`,
  })

  return claudeJSON({ model: CLAUDE_MODELS.SONNET, content, maxTokens: 500 })
}

export default function AddToCalendarModal({ onClose }) {
  const [text, setText] = useState('')
  const [imagePreview, setImagePreview] = useState(null) // data URL for <img>
  const [imageBase64, setImageBase64] = useState(null)   // stripped base64 for the API
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [editField, setEdit] = useState({})
  const [saving, setSaving] = useState(null) // null | 'saving' | 'done' | 'error'
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const field = (key) => editField[key] ?? extracted?.[key] ?? ''
  const setField = (key, val) => setEdit(e => ({ ...e, [key]: val }))

  async function handleImage(fileOrBlob) {
    const dataUrl = await downscaleImage(fileOrBlob)
    setImagePreview(dataUrl)
    setImageBase64(dataUrl.split(',')[1])
  }

  function onPaste(e) {
    const item = [...e.clipboardData.items].find(i => i.type.startsWith('image/'))
    if (item) {
      e.preventDefault()
      handleImage(item.getAsFile())
    }
  }

  function onFileChange(e) {
    const file = e.target.files?.[0]
    if (file) handleImage(file)
  }

  async function extract() {
    if (!text.trim() && !imageBase64) return
    setExtracting(true); setError(null); setExtracted(null); setEdit({})
    try { setExtracted(await extractCalendarEvent({ text, imageBase64 })) }
    catch (e) { setError(e.message) }
    finally { setExtracting(false) }
  }

  async function createEvent() {
    setSaving('saving'); setError(null)
    try {
      const date = field('date')
      const startTime = field('start_time')
      const endTime = field('end_time') || (startTime ? addOneHour(startTime) : '')

      await createCalendarEvent({
        title: field('title'),
        date,
        startTime,
        endTime,
        location: field('location'),
        description: field('description'),
      })
      setSaving('done')
    } catch (e) {
      setError(e.message)
      setSaving('error')
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-4 flex items-center justify-between">
        <h2 className="text-base font-heading font-semibold text-ink-900">Add to Calendar</h2>
        <button onClick={onClose} className="w-7 h-7 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-500 text-sm">✕</button>
      </div>

      <div className="px-5 py-4 space-y-4">
        {error && <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-700">{error}</div>}

        <div>
          <p className="text-sm font-medium text-ink-700 mb-1">Paste a screenshot or text</p>
          <p className="text-xs text-ink-400 mb-3">
            Paste (⌘V) an interview-invite screenshot or a scheduling text/email — or just paste the plain text. Claude extracts the event details for you to review before it's created on your calendar.
          </p>

          {imagePreview ? (
            <div className="relative mb-2 inline-block">
              <img src={imagePreview} alt="Pasted screenshot" className="max-h-40 rounded-xl border border-ink-200" />
              <button onClick={() => { setImagePreview(null); setImageBase64(null) }}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-ink-900 text-white flex items-center justify-center hover:bg-ink-700">
                <X size={13} />
              </button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full mb-2 py-3 border border-dashed border-ink-200 rounded-xl text-xs text-ink-400 hover:border-accent-300 hover:text-accent-600 flex items-center justify-center gap-1.5">
              <ImageIcon size={14} /> Click to upload a screenshot (or paste one into the text box below)
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

          <textarea value={text} onChange={e => setText(e.target.value)} onPaste={onPaste}
            placeholder="Paste text here, or paste (⌘V) a screenshot..."
            rows={5}
            className="w-full px-4 py-3 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-accent-400 resize-none font-mono bg-ink-50" />
          <Button onClick={extract} disabled={extracting || (!text.trim() && !imageBase64)} className="mt-2">
            {extracting ? 'Extracting...' : 'Extract with Claude →'}
          </Button>
        </div>

        {extracted && (
          <div className="space-y-3 bg-white rounded-xl p-4 border border-ink-100 shadow-sm">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Review & edit before creating</p>
            <div>
              <label className="block text-xs text-ink-400 mb-0.5">Title</label>
              <input value={field('title')} onChange={e => setField('title', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">Date</label>
                <input type="date" value={field('date')} onChange={e => setField('date', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">Start</label>
                <input type="time" value={field('start_time')} onChange={e => setField('start_time', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-0.5">End</label>
                <input type="time" value={field('end_time')} onChange={e => setField('end_time', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-ink-400 mb-0.5">Location</label>
              <input value={field('location')} onChange={e => setField('location', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
            </div>
            <div>
              <label className="block text-xs text-ink-400 mb-0.5">Description</label>
              <textarea value={field('description')} onChange={e => setField('description', e.target.value)} rows={2}
                className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none" />
            </div>

            {saving === 'done' ? (
              <div className="p-3 bg-success-50 border border-success-200 rounded-xl text-sm text-success-700">
                ✓ Created on your Google Calendar.
              </div>
            ) : (
              <Button onClick={createEvent} disabled={saving === 'saving' || !field('date')} className="w-full">
                {saving === 'saving' ? 'Creating...' : '+ Create Event'}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
