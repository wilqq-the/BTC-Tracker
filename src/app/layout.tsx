import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import ThemeProvider from '@/components/ui/ThemeProvider'
import { AuthProvider } from '@/components/AuthProvider'
import { Toaster } from '@/components/ui/toaster'
import { ConfirmDialogHost } from '@/components/ui/confirm-dialog'
import AppShell from '@/components/AppShell'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
})

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
      <body className={`${jakarta.variable} font-sans antialiased`}>
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