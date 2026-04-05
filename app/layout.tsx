import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tekmadev Social Manager',
  description: 'Turn any content into LinkedIn, Instagram, and X posts',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] antialiased">
        {children}
      </body>
    </html>
  )
}
