import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import type { PostLogEntry } from './types'

const LOG_PATH = path.join(process.cwd(), 'posts-log.json')

export function readLog(): PostLogEntry[] {
  if (!existsSync(LOG_PATH)) return []
  try {
    return JSON.parse(readFileSync(LOG_PATH, 'utf-8')) as PostLogEntry[]
  } catch {
    return []
  }
}

export function appendLog(entry: PostLogEntry): void {
  const entries = readLog()
  entries.unshift(entry) // newest first
  writeFileSync(LOG_PATH, JSON.stringify(entries, null, 2), 'utf-8')
}
