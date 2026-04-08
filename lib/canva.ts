// Canva Connect API utilities — used by the carousel studio pipeline.
// All functions accept a raw access token (caller is responsible for retrieval + expiry checks).

const CANVA_API = 'https://api.canva.com/rest/v1'

// ── HTTP helpers ───────────────────────────────────────────────────────────

async function post(path: string, token: string, body: unknown) {
  const res = await fetch(`${CANVA_API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Canva POST ${path} (${res.status}): ${await res.text()}`)
  return res.json()
}

async function get(path: string, token: string) {
  const res = await fetch(`${CANVA_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Canva GET ${path} (${res.status}): ${await res.text()}`)
  return res.json()
}

// ── Polling ────────────────────────────────────────────────────────────────

async function poll(
  check: () => Promise<{ job: { status: string; result?: unknown; urls?: string[] } }>,
  intervalMs = 2000,
  timeoutMs = 60000
): Promise<unknown> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { job } = await check()
    if (job.status === 'success') return job.result ?? job.urls
    if (job.status === 'failed') throw new Error('Canva job failed')
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('Canva job timed out')
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Auto-fill a Canva brand template with slide texts.
 * The template must have text data fields named slide_1 … slide_N.
 * Returns the resulting design ID.
 */
export async function canvaAutofill(
  token: string,
  brandTemplateId: string,
  slideTexts: { number: number; text: string }[]
): Promise<string> {
  const data: Record<string, { type: 'text'; text: string }> = {}
  for (const slide of slideTexts) {
    data[`slide_${slide.number}`] = { type: 'text', text: slide.text }
  }

  const res = await post('/autofills', token, { brand_template_id: brandTemplateId, data })

  let designId: string
  if (res.job?.status === 'success') {
    designId = res.job.result.design.id
  } else {
    const result = await poll(() => get(`/autofills/${res.job.id}`, token)) as { design: { id: string } }
    designId = result.design.id
  }

  return designId
}

/**
 * Export a Canva design as JPG images (one per page).
 * Returns an array of Canva CDN URLs — one per slide/page.
 */
export async function canvaExport(token: string, designId: string): Promise<string[]> {
  const res = await post('/exports', token, { design_id: designId, format: 'jpg', export_quality: 'pro' })

  if (res.job?.status === 'success' && res.job.urls) return res.job.urls as string[]

  const urls = await poll(() => get(`/exports/${res.job.id}`, token), 2000, 30000)
  return urls as string[]
}
