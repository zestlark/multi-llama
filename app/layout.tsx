import React from "react"
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'

import './globals.css'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })
const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

export const metadata: Metadata = {
  title: 'Multi Llama Chat',
  description: 'Chat with multiple AI models simultaneously',
  generator: 'v0.app',
  manifest: `${PUBLIC_BASE_PATH}/manifest.webmanifest`,
  icons: {
    icon: [
      {
        url: `${PUBLIC_BASE_PATH}/logo-black.png`,
        type: 'image/png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: `${PUBLIC_BASE_PATH}/logo.png`,
        type: 'image/png',
        media: '(prefers-color-scheme: dark)',
      },
      { url: `${PUBLIC_BASE_PATH}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    ],
    apple: `${PUBLIC_BASE_PATH}/icon-192.png`,
    shortcut: [
      {
        url: `${PUBLIC_BASE_PATH}/logo-black.png`,
        type: 'image/png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: `${PUBLIC_BASE_PATH}/logo.png`,
        type: 'image/png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#0b0f14',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${_geist.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
