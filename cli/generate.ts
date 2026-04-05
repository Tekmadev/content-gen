#!/usr/bin/env node
/**
 * Blotato Social Manager CLI
 * Usage: npm run generate
 * Or:    npx tsx cli/generate.ts
 */

import * as readline from 'readline'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'fs'

// Load .env manually (tsx doesn't load it automatically)
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = value
  }
}

loadEnv()

// Dynamic imports after env is loaded
async function getBlotatoFns() {
  const mod = await import('../lib/blotato.js')
  return mod
}

async function getAnthropicFns() {
  const mod = await import('../lib/anthropic.js')
  return mod
}

function createRl() {
  return readline.createInterface({ input: process.stdin, output: process.stdout })
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve))
}

function hr() {
  console.log('\n' + '─'.repeat(60) + '\n')
}

async function main() {
  console.log('\n🚀 Blotato Social Manager CLI\n')

  const rl = createRl()

  hr()
  console.log('Source types:')
  console.log('  1. YouTube URL')
  console.log('  2. Article / Website URL')
  console.log('  3. PDF URL')
  console.log('  4. Email text (paste)')
  const choice = await ask(rl, '\nSelect source type (1-4): ')

  const sourceMap: Record<string, string> = {
    '1': 'youtube',
    '2': 'article',
    '3': 'pdf',
    '4': 'email',
  }
  const sourceType = sourceMap[choice.trim()]
  if (!sourceType) {
    console.error('Invalid choice. Exiting.')
    rl.close()
    process.exit(1)
  }

  let sourceInput: { sourceType: string; url?: string; text?: string }

  if (sourceType === 'email') {
    console.log('\nPaste your email content (press Enter twice when done):')
    let text = ''
    let emptyLineCount = 0
    const emailRl = createRl()
    await new Promise<void>((resolve) => {
      emailRl.on('line', (line) => {
        if (line === '') {
          emptyLineCount++
          if (emptyLineCount >= 2) { emailRl.close(); resolve(); return }
        } else {
          emptyLineCount = 0
        }
        text += line + '\n'
      })
    })
    sourceInput = { sourceType: 'text', text: text.trim() }
  } else {
    const url = await ask(rl, '\nEnter URL: ')
    sourceInput = { sourceType, url: url.trim() }
  }

  hr()
  console.log('Step 1/3: Extracting content from source...')

  const { extractContent, listAccounts, publishPost, pollPost } = await getBlotatoFns()
  const { generateAllPosts } = await getAnthropicFns()

  const extracted = await extractContent(sourceInput as Parameters<typeof extractContent>[0])
  const content = extracted.content ?? extracted.title ?? ''

  if (!content) {
    console.error('Could not extract content from source.')
    rl.close()
    process.exit(1)
  }

  console.log(`\n✓ Extracted ${content.length} characters of content.`)

  hr()
  console.log('Step 2/3: Generating platform-specific posts with Claude...')

  const posts = await generateAllPosts(content)

  console.log('\n✓ Posts generated.\n')

  hr()
  console.log('LINKEDIN POST:')
  console.log(posts.linkedin)

  hr()
  console.log('INSTAGRAM POST:')
  console.log(posts.instagram)

  hr()
  console.log('X / TWITTER POST:')
  console.log(posts.x)

  hr()

  const approve = await ask(rl, 'Approve and publish all? (yes to confirm, no to edit first): ')

  if (approve.trim().toLowerCase() !== 'yes') {
    console.log('\nEdit the generated text in your review UI at /review.')
    console.log('Posts saved as draft — open the web app to review and publish.')
    rl.close()
    return
  }

  hr()
  console.log('Step 3/3: Fetching your connected accounts...')

  const accounts = await listAccounts()
  if (!accounts.length) {
    console.error('No accounts found. Connect accounts in Blotato first.')
    rl.close()
    process.exit(1)
  }

  accounts.forEach((a, i) => {
    console.log(`  ${i + 1}. [${a.platform}] ${a.displayName || a.username} (${a.id})`)
  })

  const linkedinAcc = accounts.find((a) => a.platform === 'linkedin')
  const instagramAcc = accounts.find((a) => a.platform === 'instagram')
  const twitterAcc = accounts.find((a) => a.platform === 'twitter')

  const results: Record<string, string | null> = {}

  console.log('\nPublishing...')

  if (linkedinAcc) {
    process.stdout.write('  LinkedIn... ')
    const sid = await publishPost({ platform: 'linkedin', accountId: linkedinAcc.id, text: posts.linkedin }).catch((e: Error) => { console.error(`FAIL: ${e.message}`); return null })
    if (sid) {
      const r = await pollPost(sid).catch(() => null)
      results.linkedin = r?.url ?? null
      console.log(r?.url ? `✓ ${r.url}` : '✓ published')
    }
  }

  if (instagramAcc) {
    process.stdout.write('  Instagram... ')
    const sid = await publishPost({ platform: 'instagram', accountId: instagramAcc.id, text: posts.instagram, mediaType: 'IMAGE', altText: posts.instagram.slice(0, 100) }).catch((e: Error) => { console.error(`FAIL: ${e.message}`); return null })
    if (sid) {
      const r = await pollPost(sid).catch(() => null)
      results.instagram = r?.url ?? null
      console.log(r?.url ? `✓ ${r.url}` : '✓ published')
    }
  }

  if (twitterAcc) {
    process.stdout.write('  X/Twitter... ')
    const sid = await publishPost({ platform: 'twitter', accountId: twitterAcc.id, text: posts.x }).catch((e: Error) => { console.error(`FAIL: ${e.message}`); return null })
    if (sid) {
      const r = await pollPost(sid).catch(() => null)
      results.x = r?.url ?? null
      console.log(r?.url ? `✓ ${r.url}` : '✓ published')
    }
  }

  // Append to local log
  const logPath = path.join(process.cwd(), 'posts-log.json')
  let log: unknown[] = []
  if (fs.existsSync(logPath)) {
    try { log = JSON.parse(fs.readFileSync(logPath, 'utf-8')) } catch { log = [] }
  }
  log.unshift({
    id: crypto.randomUUID(),
    publishedAt: new Date().toISOString(),
    sourceType,
    sourceUrl: sourceInput.url,
    linkedinUrl: results.linkedin,
    instagramUrl: results.instagram,
    xUrl: results.x,
    linkedinText: posts.linkedin,
    instagramText: posts.instagram,
    xText: posts.x,
  })
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2))

  hr()
  console.log('✓ Done! Posts published and logged to posts-log.json\n')

  rl.close()
}

main().catch((err) => {
  console.error('\nError:', err.message)
  process.exit(1)
})
