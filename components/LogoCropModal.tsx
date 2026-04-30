'use client'

/**
 * LogoCropModal — square (1:1) crop UI for brand logo uploads.
 *
 * Opens after a user picks a file. Shows the image in a 1:1 crop area
 * with pan + zoom controls. On confirm, produces a JPEG/PNG Blob
 * sized to a square at the user's chosen region. Caller uploads the
 * resulting blob.
 *
 * Library: react-easy-crop. Output is generated client-side via canvas
 * so the upload endpoint always receives a perfectly square image —
 * no server-side cropping needed.
 */

import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'

interface Props {
  /** The data URL or object URL of the source image to crop. */
  src: string
  /** Original file's MIME type so we can preserve PNG transparency. */
  mimeType: string
  /** Output edge length in pixels. Defaults to 512 — plenty for logos. */
  outputSize?: number
  /** Called with the cropped square Blob when user confirms. */
  onConfirm: (blob: Blob) => void
  /** Called when user cancels — caller should clear their pending file. */
  onCancel: () => void
}

/**
 * Renders a square crop region from the source image to a Canvas, then
 * exports as a Blob. PNG output preserves transparency (important for logos).
 */
async function cropToSquareBlob(
  src: string,
  cropArea: Area,
  outputSize: number,
  mimeType: string
): Promise<Blob> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = (err) => reject(err)
    image.src = src
  })

  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D context for cropping')

  // Preserve transparency for PNG/SVG, fill white for JPEG (no alpha)
  const outputType = mimeType === 'image/png' || mimeType === 'image/svg+xml' ? 'image/png' : 'image/jpeg'

  // Fill background — only meaningful for JPEG (PNG keeps the transparency)
  if (outputType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, outputSize, outputSize)
  }

  ctx.drawImage(
    image,
    cropArea.x,      cropArea.y,      cropArea.width, cropArea.height,
    0,               0,               outputSize,     outputSize
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas → Blob failed'))),
      outputType,
      0.92
    )
  })
}

export default function LogoCropModal({
  src,
  mimeType,
  outputSize = 512,
  onConfirm,
  onCancel,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    setSaving(true)
    setError('')
    try {
      const blob = await cropToSquareBlob(src, croppedAreaPixels, outputSize, mimeType)
      onConfirm(blob)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crop failed')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="font-semibold text-[var(--foreground)] text-sm">Crop your logo</h3>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Pan and zoom to fit the square. Logos must be 1:1 so they sit cleanly on every slide.
          </p>
        </div>

        {/* Cropper */}
        <div className="relative w-full h-72 sm:h-80 bg-[var(--surface)]">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
            showGrid={true}
            cropShape="rect"
            restrictPosition={false}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-3 border-t border-[var(--border)]">
          <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">Zoom</label>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-[var(--muted)]">−</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-[var(--surface)] rounded-full appearance-none cursor-pointer accent-[var(--primary)]"
            />
            <span className="text-xs text-[var(--muted)]">+</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="px-5 pb-2 text-xs text-red-600">{error}</p>
        )}

        {/* Actions */}
        <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface)] transition-colors text-[var(--foreground)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || !croppedAreaPixels}
            className="px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Cropping…
              </>
            ) : 'Use this crop'}
          </button>
        </div>
      </div>
    </div>
  )
}
