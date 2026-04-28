'use client'

import { useState } from 'react'
import type { BrandBrief, AudienceSegment, BriefService } from '@/lib/types'

interface Props {
  brief: BrandBrief
  onUpdate: (updated: Partial<BrandBrief>) => Promise<void>
  onReset: () => void
}

function Tag({ label }: { label: string }) {
  return (
    <span className="inline-block bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 text-xs font-medium px-2.5 py-1 rounded-full">
      {label}
    </span>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
        <span>{icon}</span>
        <h3 className="font-semibold text-[var(--foreground)] text-sm">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function EditableField({
  label,
  value,
  onSave,
  multiline = false,
}: {
  label: string
  value: string
  onSave: (v: string) => void
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (editing) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
        {multiline ? (
          <textarea
            className="w-full bg-[var(--surface)] border border-[var(--accent)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none resize-none"
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        ) : (
          <input
            className="w-full bg-[var(--surface)] border border-[var(--accent)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        )}
        <div className="flex gap-2">
          <button
            onClick={() => { onSave(draft); setEditing(false) }}
            className="text-xs bg-[var(--accent)] text-white px-3 py-1 rounded-lg hover:opacity-90"
          >
            Save
          </button>
          <button
            onClick={() => { setDraft(value); setEditing(false) }}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="group cursor-pointer rounded-lg px-2 py-1 -mx-2 hover:bg-[var(--surface)] transition-colors"
      onClick={() => { setDraft(value); setEditing(true) }}
    >
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="text-sm text-[var(--foreground)] mt-0.5">{value || <span className="italic opacity-40">Not set</span>}</p>
      <p className="text-xs text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">Click to edit</p>
    </div>
  )
}

function EditableList({
  label,
  items,
  onSave,
}: {
  label: string
  items: string[]
  onSave: (items: string[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(items.join('\n'))

  if (editing) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-[var(--muted-foreground)]">{label} <span className="opacity-60">(one per line)</span></p>
        <textarea
          className="w-full bg-[var(--surface)] border border-[var(--accent)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none resize-none"
          rows={Math.max(3, items.length + 1)}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={() => {
              onSave(draft.split('\n').map((s) => s.trim()).filter(Boolean))
              setEditing(false)
            }}
            className="text-xs bg-[var(--accent)] text-white px-3 py-1 rounded-lg hover:opacity-90"
          >
            Save
          </button>
          <button
            onClick={() => { setDraft(items.join('\n')); setEditing(false) }}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="group cursor-pointer rounded-lg px-2 py-1 -mx-2 hover:bg-[var(--surface)] transition-colors"
      onClick={() => { setDraft(items.join('\n')); setEditing(true) }}
    >
      <p className="text-xs text-[var(--muted-foreground)] mb-1.5">{label}</p>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => <Tag key={i} label={item} />)}
        </div>
      ) : (
        <p className="text-sm italic opacity-40">Not set</p>
      )}
      <p className="text-xs text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity mt-1">Click to edit</p>
    </div>
  )
}

export default function BrandBriefDisplay({ brief, onUpdate, onReset }: Props) {
  const [tab, setTab] = useState<'overview' | 'raw'>('overview')
  const [saving, setSaving] = useState(false)

  // Null-safe defaults — Gemini occasionally omits fields and the response
  // payload may have undefined arrays. Default everything so the UI never crashes.
  const personalityWords = brief.personality_words ?? []
  const contentPillars   = brief.content_pillars   ?? []
  const alwaysSay        = brief.always_say        ?? []
  const neverSay         = brief.never_say         ?? []
  const examplePhrases   = brief.example_phrases   ?? []
  const audiences        = brief.audiences         ?? []
  const services         = brief.services          ?? []
  const referenceImages  = brief.reference_images  ?? []

  const save = async (patch: Partial<BrandBrief>) => {
    setSaving(true)
    await onUpdate(patch)
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {brief.business_name || 'Your Brand Profile'}
          </h1>
          {brief.tagline && (
            <p className="text-[var(--muted-foreground)] text-sm mt-1">{brief.tagline}</p>
          )}
          {brief.brief_generated_at && (
            <p className="text-xs text-[var(--muted-foreground)] mt-1 opacity-60">
              Last updated {new Date(brief.brief_generated_at).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <span className="text-xs text-[var(--muted-foreground)]">Saving…</span>}
          <button
            onClick={onReset}
            className="text-xs border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-1.5 rounded-lg transition-colors"
          >
            Restart wizard
          </button>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 p-1 bg-[var(--surface)] rounded-xl border border-[var(--border)] w-fit">
        {(['overview', 'raw'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {t === 'raw' ? 'Full Brief' : 'Overview'}
          </button>
        ))}
      </div>

      {tab === 'raw' ? (
        <div className="border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
            <span className="text-sm font-semibold text-[var(--foreground)]">Full Brand Brief</span>
            <button
              onClick={() => navigator.clipboard.writeText(brief.generated_brief)}
              className="text-xs text-[var(--accent)] hover:opacity-75"
            >
              Copy
            </button>
          </div>
          <div className="px-5 py-5 max-h-[60vh] overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-[var(--foreground)] font-mono leading-relaxed">
              {brief.generated_brief}
            </pre>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Identity */}
          <Section title="Identity" icon="🏢">
            <div className="space-y-3">
              <EditableField label="Business name" value={brief.business_name}
                onSave={(v) => save({ business_name: v })} />
              <EditableField label="Tagline" value={brief.tagline}
                onSave={(v) => save({ tagline: v })} />
              <EditableField label="Founded" value={brief.founded}
                onSave={(v) => save({ founded: v })} />
              <EditableField label="Location" value={brief.location}
                onSave={(v) => save({ location: v })} />
              <EditableField label="Website" value={brief.website}
                onSave={(v) => save({ website: v })} />
              <EditableField label="What we do" value={brief.business_description}
                onSave={(v) => save({ business_description: v })} multiline />
              <EditableField label="Mission" value={brief.mission}
                onSave={(v) => save({ mission: v })} multiline />
            </div>
          </Section>

          {/* Brand Personality */}
          <Section title="Brand Personality" icon="✨">
            <div className="space-y-3">
              <EditableList
                label="Personality words"
                items={personalityWords}
                onSave={(v) => save({ personality_words: v })}
              />
              <EditableField label="Tone of voice" value={brief.tone_of_voice}
                onSave={(v) => save({ tone_of_voice: v })} multiline />
              <EditableField label="Brand character" value={brief.brand_character}
                onSave={(v) => save({ brand_character: v })} multiline />
              <EditableField label="What makes us different" value={brief.unique_value}
                onSave={(v) => save({ unique_value: v })} multiline />
            </div>
          </Section>

          {/* Content Strategy */}
          <Section title="Content Strategy" icon="📣">
            <div className="space-y-3">
              <EditableList
                label="Content pillars"
                items={contentPillars}
                onSave={(v) => save({ content_pillars: v })}
              />
              <EditableField label="Content goals" value={brief.content_goals}
                onSave={(v) => save({ content_goals: v })} multiline />
            </div>
          </Section>

          {/* Voice Rules */}
          <Section title="Voice Rules" icon="🗣️">
            <div className="space-y-3">
              <EditableList label="Always say" items={alwaysSay}
                onSave={(v) => save({ always_say: v })} />
              <EditableList label="Never say" items={neverSay}
                onSave={(v) => save({ never_say: v })} />
              <EditableList label="Example phrases" items={examplePhrases}
                onSave={(v) => save({ example_phrases: v })} />
            </div>
          </Section>

          {/* Target Audiences */}
          <div className="md:col-span-2">
            <Section title="Target Audiences" icon="🎯">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {audiences.length ? audiences.map((a: AudienceSegment, i) => (
                  <div key={i} className="border border-[var(--border)] rounded-xl p-4 space-y-2">
                    <p className="font-semibold text-sm text-[var(--foreground)]">{a.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{a.description}</p>
                    {a.pain_points?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">Pain points</p>
                        <ul className="space-y-0.5">
                          {a.pain_points.map((p, j) => (
                            <li key={j} className="text-xs text-[var(--foreground)] flex gap-1">
                              <span className="text-red-400 mt-0.5">·</span>{p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {a.goals?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">Goals</p>
                        <ul className="space-y-0.5">
                          {a.goals.map((g, j) => (
                            <li key={j} className="text-xs text-[var(--foreground)] flex gap-1">
                              <span className="text-green-400 mt-0.5">·</span>{g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )) : (
                  <p className="text-sm italic text-[var(--muted-foreground)] col-span-full">No audience segments defined</p>
                )}
              </div>
            </Section>
          </div>

          {/* Services */}
          <div className="md:col-span-2">
            <Section title="Services & Offerings" icon="🛠️">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.length ? services.map((s: BriefService, i) => (
                  <div key={i} className="border border-[var(--border)] rounded-xl p-4 space-y-2">
                    <p className="font-semibold text-sm text-[var(--foreground)]">{s.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{s.description}</p>
                    {s.key_message && (
                      <p className="text-xs text-[var(--accent)] italic">"{s.key_message}"</p>
                    )}
                    {s.outcome && (
                      <p className="text-xs text-[var(--foreground)]">
                        <span className="font-medium">Outcome:</span> {s.outcome}
                      </p>
                    )}
                  </div>
                )) : (
                  <p className="text-sm italic text-[var(--muted-foreground)] col-span-full">No services defined</p>
                )}
              </div>
            </Section>
          </div>

          {/* Reference Images */}
          {referenceImages.length > 0 && (
            <div className="md:col-span-2">
              <Section title="Visual References" icon="🖼️">
                <div className="flex flex-wrap gap-3">
                  {referenceImages.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Reference ${i + 1}`}
                      className="h-28 w-28 object-cover rounded-xl border border-[var(--border)]"
                    />
                  ))}
                </div>
              </Section>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
