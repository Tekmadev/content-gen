import type {
  SourceInput,
  ExtractedContent,
  Visual,
  BlotatoAccount,
  BlotatoSubAccount,
  BlotatoTemplate,
  PublishResult,
} from './types'

const BASE_URL = 'https://backend.blotato.com/v2'

function getHeaders() {
  const key = process.env.BLOTATO_API_KEY
  if (!key) throw new Error('BLOTATO_API_KEY is not set')
  return {
    'Content-Type': 'application/json',
    'blotato-api-key': key,
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Content Extraction ─────────────────────────────────────────────────────

export async function startExtraction(source: SourceInput): Promise<string> {
  const body = { source }
  const res = await fetch(`${BASE_URL}/source-resolutions-v3`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Blotato extraction start failed: ${err}`)
  }
  const data = await res.json()
  return data.id as string
}

export async function pollExtraction(id: string, maxWaitMs = 120_000): Promise<ExtractedContent> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE_URL}/source-resolutions-v3/${id}`, {
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error(`Blotato poll extraction failed: ${res.status}`)
    const data: ExtractedContent = await res.json()
    if (data.status === 'completed') return data
    if (data.status === 'failed') {
      const reason = data.error ?? data.message ?? data.reason ?? 'unknown reason'
      throw new Error(`Blotato content extraction failed: ${reason}`)
    }
    await sleep(3000)
  }
  throw new Error('Blotato extraction timed out')
}

export async function extractContent(source: SourceInput): Promise<ExtractedContent> {
  const id = await startExtraction(source)
  return pollExtraction(id)
}

// ── Templates ──────────────────────────────────────────────────────────────

export async function listTemplates(): Promise<BlotatoTemplate[]> {
  const res = await fetch(`${BASE_URL}/videos/templates?fields=id,name,description`, {
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`Blotato list templates failed: ${res.status}`)
  const data = await res.json()
  // API returns { items: [...] }
  return (data.items ?? data) as BlotatoTemplate[]
}

// ── Visual Generation ──────────────────────────────────────────────────────

export async function startVisual(templateId: string, prompt: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/videos/from-templates`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ templateId, inputs: {}, prompt, render: true }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Blotato visual start failed: ${err}`)
  }
  const data = await res.json()
  return data.id as string
}

export async function pollVisual(id: string, maxWaitMs = 180_000): Promise<Visual> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE_URL}/videos/creations/${id}`, {
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error(`Blotato poll visual failed: ${res.status}`)
    const data: Visual = await res.json()
    if (data.status === 'done') return data
    if (data.status === 'creation-from-template-failed')
      throw new Error('Blotato visual generation failed')
    await sleep(5000)
  }
  throw new Error('Blotato visual generation timed out')
}

export async function generateVisual(templateId: string, prompt: string): Promise<string> {
  const id = await startVisual(templateId, prompt)
  const visual = await pollVisual(id)
  return visual.mediaUrl ?? visual.imageUrls?.[0] ?? ''
}

// ── Accounts ───────────────────────────────────────────────────────────────

export async function listAccounts(): Promise<BlotatoAccount[]> {
  const res = await fetch(`${BASE_URL}/users/me/accounts`, {
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`Blotato list accounts failed: ${res.status}`)
  const data = await res.json()
  // API returns { items: [...] }
  return (data.items ?? data) as BlotatoAccount[]
}

export async function listSubAccounts(accountId: string): Promise<BlotatoSubAccount[]> {
  const res = await fetch(`${BASE_URL}/users/me/accounts/${accountId}/subaccounts`, {
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`Blotato list subaccounts failed: ${res.status}`)
  const data = await res.json()
  // API returns { items: [...] }
  return (data.items ?? data) as BlotatoSubAccount[]
}

// ── Publishing ─────────────────────────────────────────────────────────────

export interface PublishPostInput {
  platform: 'twitter' | 'linkedin' | 'instagram' | 'facebook'
  accountId: string
  pageId?: string        // required for facebook, optional for linkedin
  text: string
  mediaUrls?: string[]
  mediaType?: string     // for instagram: 'IMAGE' | 'VIDEO' | 'REELS'
  altText?: string       // for instagram
}

export async function publishPost(input: PublishPostInput): Promise<string> {
  const post: Record<string, unknown> = {
    accountId: input.accountId,
    content: {
      text: input.text,
      mediaUrls: input.mediaUrls ?? [],
      platform: input.platform,
    },
    target: {
      targetType: input.platform,
    },
  }

  if (input.platform === 'linkedin' && input.pageId) {
    post.target = { ...post.target as object, pageId: input.pageId }
  }

  if (input.platform === 'facebook') {
    if (!input.pageId) throw new Error('Facebook requires pageId')
    post.target = { ...post.target as object, pageId: input.pageId }
  }

  if (input.platform === 'instagram') {
    post.mediaType = input.mediaType ?? 'IMAGE'
    post.altText = input.altText ?? ''
    post.shareToFeed = true
    post.collaborators = []
  }

  const res = await fetch(`${BASE_URL}/posts`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ post }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Blotato publish failed: ${err}`)
  }

  const data = await res.json()
  return data.postSubmissionId as string
}

export async function pollPost(submissionId: string, maxWaitMs = 120_000): Promise<PublishResult> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE_URL}/posts/${submissionId}`, {
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error(`Blotato poll post failed: ${res.status}`)
    const data: PublishResult = await res.json()
    if (data.status === 'published') return data
    if (data.status === 'failed') throw new Error('Blotato post publish failed')
    await sleep(3000)
  }
  throw new Error('Blotato post publish timed out')
}
