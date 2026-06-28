import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ThemeProvider from '@/components/ui/ThemeProvider'
import { AuthProvider } from '@/components/AuthProvider'
import { Toaster } from '@/components/ui/toaster'
import { ConfirmDialogHost } from '@/components/ui/confirm-dialog'
import AppShell from '@/components/AppShell'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BTC Tracker',
  description: 'Self-hosted Bitcoin portfolio tracker for true HODLers',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>
          <ThemeProvider>
            <AppShell>{children}</AppShell>
            <Toaster />
            <ConfirmDialogHost />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
} 