import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { createClient } from '@/lib/supabase/server'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Volume Profile',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-white`}>
        {user ? (
          <div className="flex min-h-screen">
            <Nav />
            <main className="flex-1 p-8 overflow-auto">{children}</main>
          </div>
        ) : (
          <>{children}</>
        )}
      </body>
    </html>
  )
}
