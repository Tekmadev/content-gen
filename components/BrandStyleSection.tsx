'use client'

/**
 * BrandStyleSection — visual style controls (logo, colors, font) used by
 * carousel image generation. Reads/writes the `brand_settings` table.
 *
 * Self-contained: loads its own data on mount, handles its own save state.
 * Drop into any page by rendering <BrandStyleSection />.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BrandSettings, ImageGenerator } from '@/lib/types'

const FONT_OPTIONS = [
  'Inter',
  'Helvetica Neue',
  'Montserrat',
  'Playfair Display',
  'Georgia',
  'Raleway',
  'Roboto',
  'Source Serif',
  'DM Sans',
  'Space Grotesk',
]

const DEFAULT_BRAND: BrandSettings = {
  primary_color:          '#000000',
  secondary_color:        '#ffffff',
  accent_color:           '#F97316',
  background_color:       '#ffffff',
  text_color:             '#111111',
  font_family:            'Inter',
  brand_name:             '',
  logo_url:               '',
  carousel_image_model:   'gemini' as ImageGenerator,
  carousel_custom_prompt: '',
}

const COLOR_FIELDS: { key: keyof BrandSettings; label: string; hint: string }[] = [
  { key: 'primary_color',    label: 'Primary Color',    hint: 'Main brand color — buttons, key elements' },
  { key: 'secondary_color',  label: 'Secondary Color',  hint: 'Supporting / contrast color' },
  { key: 'accent_color',     label: 'Accent Color',     hint: 'Highlights, CTAs, decorative details' },
  { key: 'background_color', label: 'Background Color', hint: 'Slide background' },
  { key: 'text_color',       label: 'Text Color',       hint: 'Main body and headline text' },
]

export default function BrandStyleSection() {
  const [brand, setBrand] = useState<BrandSettings>(DEFAULT_BRAND)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Logo state
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Load existing brand settings
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/brand-settings')
        if (res.ok) {
          const data = await res.json()
          setBrand({
            ...DEFAULT_BRAND,
            ...data,
            carousel_custom_prompt: data.carousel_custom_prompt ?? '',
          })
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const saveBrand = useCallback(async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/brand-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brand),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Save failed')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
    setSaving(false)
  }, [brand])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    setLogoError('')
    try {
      const form = new FormData()
      form.append('logo', file)
      const res = await fetch('/api/brand-settings/logo', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setBrand((b) => ({ ...b, logo_url: data.logo_url }))
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Upload failed')
    }
    setLogoUploading(false)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  const handleLogoRemove = async () => {
    setLogoError('')
    await fetch('/api/brand-settings/logo', { method: 'DELETE' })
    setBrand((b) => ({ ...b, logo_url: '' }))
  }

  if (loading) {
    return (
      <div className="border border-[var(--border)] rounded-2xl p-8 flex items-center justify-center">
        <span className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="border border-[var(--border)] rounded-2xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-5 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
        <span>🎨</span>
        <h3 className="font-semibold text-[var(--foreground)] text-sm">Brand Style</h3>
        <p className="text-xs text-[var(--muted-foreground)] ml-2 hidden sm:block">
          Logo, colors, and font for AI-generated visuals
        </p>
      </div>

      <div className="px-5 py-5 space-y-5">

        {/* Live preview */}
        <div
          className="w-full h-20 rounded-xl flex items-center justify-center text-sm font-semibold border border-[var(--border)] transition-all"
          style={{
            backgroundColor: brand.background_color,
            color: brand.text_color,
            fontFamily: brand.font_family,
          }}
        >
          <span style={{ color: brand.accent_color, marginRight: 6 }}>✦</span>
          {brand.brand_name || 'Your Brand'} — Preview
        </div>

        {/* Brand name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--foreground)]">Brand / Company Name</label>
          <input
            type="text"
            value={brand.brand_name}
            onChange={(e) => setBrand((b) => ({ ...b, brand_name: e.target.value }))}
            placeholder="e.g. Tekmadev"
            className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        {/* Brand Logo */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-[var(--foreground)]">Brand Logo</label>
          <p className="text-xs text-[var(--muted-foreground)]">
            Automatically composited onto every generated carousel slide. PNG with transparent background works best.
          </p>
          {brand.logo_url ? (
            <div className="flex items-center gap-3 p-3 border border-[var(--border)] rounded-xl bg-[var(--surface)]">
              <div className="w-16 h-16 rounded-lg border border-[var(--border)] bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src={brand.logo_url} alt="Brand logo" className="max-w-full max-h-full object-contain p-1" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--foreground)]">Logo uploaded</p>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Will appear on all carousel slides</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors disabled:opacity-50 text-[var(--foreground)]"
                >
                  Replace
                </button>
                <button
                  onClick={handleLogoRemove}
                  className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
              className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-[var(--border)] rounded-xl hover:border-[var(--accent)]/50 hover:bg-[var(--surface)] transition-colors text-left disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 text-lg">
                {logoUploading ? '⏳' : '🖼'}
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--foreground)]">{logoUploading ? 'Uploading…' : 'Upload logo'}</p>
                <p className="text-[11px] text-[var(--muted-foreground)]">PNG, JPG, WEBP, SVG — max 2 MB</p>
              </div>
            </button>
          )}
          {logoError && <p className="text-xs text-red-500">{logoError}</p>}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>

        {/* Colors + font grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {COLOR_FIELDS.map(({ key, label, hint }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--foreground)]">{label}</label>
              <p className="text-xs text-[var(--muted-foreground)]">{hint}</p>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={brand[key] as string}
                  onChange={(e) => setBrand((b) => ({ ...b, [key]: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-[var(--border)] cursor-pointer p-0.5 bg-white flex-shrink-0"
                />
                <input
                  type="text"
                  value={brand[key] as string}
                  onChange={(e) => {
                    const val = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                      setBrand((b) => ({ ...b, [key]: val }))
                    }
                  }}
                  placeholder="#000000"
                  className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm font-mono bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  maxLength={7}
                />
              </div>
            </div>
          ))}

          {/* Font picker */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--foreground)]">Font Family</label>
            <p className="text-xs text-[var(--muted-foreground)]">Typography style for generated visuals</p>
            <select
              value={brand.font_family}
              onChange={(e) => setBrand((b) => ({ ...b, font_family: e.target.value }))}
              className="mt-1 w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          onClick={saveBrand}
          disabled={saving}
          className="self-start px-5 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Brand Style'}
        </button>
      </div>
    </div>
  )
}
