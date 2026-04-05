export type SourceType = 'youtube' | 'article' | 'email' | 'pdf'

// Blotato uses 'text' instead of 'email' — mapped in the API route
type BlotatoSourceType = 'youtube' | 'article' | 'pdf' | 'text'

export interface SourceInput {
  sourceType: SourceType | BlotatoSourceType
  url?: string       // for youtube, article, pdf
  text?: string      // for email/text
}

export interface ExtractedContent {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  content?: string
  title?: string
}

export interface GeneratedPosts {
  linkedin: string
  instagram: string
  x: string
}

export interface Visual {
  id: string
  status: 'queueing' | 'generating-script' | 'done' | 'creation-from-template-failed'
  mediaUrl?: string
  imageUrls?: string[]
}

export interface BlotatoAccount {
  id: string
  platform: 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'tiktok'
  username: string
  displayName: string
}

export interface BlotatoSubAccount {
  id: string
  name: string
  type: string
}

export interface BlotatoTemplate {
  id: string
  name: string
  description?: string
}

export interface PublishResult {
  postSubmissionId: string
  status: 'in-progress' | 'published' | 'failed'
  url?: string
}

export interface PostDraft {
  id: string
  user_id: string
  source_type: SourceType
  source_url?: string
  source_content?: string
  extracted_content?: string
  linkedin_text?: string
  instagram_text?: string
  x_text?: string
  linkedin_visual_url?: string
  instagram_visual_url?: string
  x_visual_url?: string
  linkedin_blotato_id?: string
  instagram_blotato_id?: string
  x_blotato_id?: string
  linkedin_url?: string
  instagram_url?: string
  x_url?: string
  status: 'draft' | 'generating' | 'ready' | 'publishing' | 'published' | 'failed'
  error_message?: string
  created_at: string
  published_at?: string
}

export interface PostLogEntry {
  id: string
  publishedAt: string
  sourceType: SourceType
  sourceUrl?: string
  linkedinUrl?: string
  instagramUrl?: string
  xUrl?: string
  linkedinText: string
  instagramText: string
  xText: string
}
