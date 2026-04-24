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
  error?: string
  message?: string
  reason?: string
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
  status: 'draft' | 'generating' | 'ready' | 'publishing' | 'published' | 'failed' | 'publish_failed'
  error_message?: string
  linkedin_publish_error?: string
  instagram_publish_error?: string
  x_publish_error?: string
  created_at: string
  published_at?: string
}

// ── Brand Settings ─────────────────────────────────────────────────────────

export interface BrandSettings {
  primary_color:    string   // hex, e.g. '#1a1a2e'
  secondary_color:  string   // hex
  accent_color:     string   // hex, e.g. '#F97316'
  background_color: string   // hex
  text_color:       string   // hex
  font_family:      string   // e.g. 'Inter', 'Helvetica Neue', 'Playfair Display'
  brand_name:       string   // optional brand/company name
  logo_url?:        string   // public URL of uploaded brand logo (composited onto slides)
  // Carousel AI settings
  carousel_image_model:   string  // 'gemini' | 'canva'
  carousel_custom_prompt: string  // '' = use built-in style prompts
  canva_template_id?:     string  // Canva brand template ID for auto-fill
}

// ── Carousel / Image Generator Types ──────────────────────────────────────

export type CarouselPlatform = 'instagram_carousel' | 'linkedin_image' | 'x_image'

export type CarouselStyle = 'white_card' | 'dark_statement' | 'gradient_bold' | 'cinematic' | 'branded_minimal' | 'brand_colors'

export interface CarouselSlide {
  number: number
  type: 'hook' | 'body' | 'insight' | 'cta'
  text: string
  url: string              // Supabase Storage public URL (empty string if upload failed)
  fallbackBase64?: string  // raw base64 if storage upload failed — use for local download
  fallbackMime?: string
}

export interface CarouselJob {
  jobId: string
  platform: CarouselPlatform
  style: CarouselStyle
  numSlides: number
  slides: CarouselSlide[]
  draftId?: string  // linked post draft (optional)
  createdAt: string
}

// ── Viral Carousel (10-slide studio format) ────────────────────────────────

export type ViralSlideType =
  | 'hook'
  | 'rehook'
  | 'pain'
  | 'value'
  | 'turning_point'
  | 'takeaway'
  | 'cta'

export interface ViralSlide {
  number: number
  type: ViralSlideType
  label: string   // e.g. "HOOK", "REHOOK", "VALUE 1" — internal only, not shown on slide
  text: string    // short punchy headline (≤10 words)
  body?: string   // supporting 1-2 sentence body text shown below the headline
}

// Canva OAuth token (stored per user in canva_tokens table)
export interface CanvaToken {
  user_id: string
  access_token: string
  refresh_token?: string
  expires_at?: string
}

// ── Brand Brief ────────────────────────────────────────────────────────────

export interface AudienceSegment {
  name:        string
  description: string
  pain_points: string[]
  goals:       string[]
}

export interface BriefService {
  name:        string
  description: string
  key_message: string
  outcome:     string
}

export interface ChatMessage {
  role:    'user' | 'model'
  content: string
}

export interface BrandBrief {
  id?:                string
  user_id?:           string
  // Identity
  business_name:      string
  tagline:            string
  founded:            string
  location:           string
  website:            string
  business_description: string
  mission:            string
  // Audience
  audiences:          AudienceSegment[]
  // Personality
  personality_words:  string[]
  tone_of_voice:      string
  brand_character:    string
  // Services
  services:           BriefService[]
  unique_value:       string
  // Content
  content_pillars:    string[]
  content_goals:      string
  // Voice
  always_say:         string[]
  never_say:          string[]
  example_phrases:    string[]
  // Visuals
  reference_images:   string[]
  // Generated output
  generated_brief:    string
  brief_generated_at: string | null
  // Chat state
  chat_history:       ChatMessage[]
  chat_completed:     boolean
  created_at?:        string
  updated_at?:        string
}

// ── Post Log ───────────────────────────────────────────────────────────────

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
