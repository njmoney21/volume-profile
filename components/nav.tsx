'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'

const navItems = [
  { href: '/journal', label: 'Journal' },
  { href: '/backtest', label: 'Backtest' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/concepts', label: 'Concepts' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="w-56 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col py-6 px-4 shrink-0">
      <span className="text-white font-semibold text-base mb-8 px-2">Volume Profile</span>
      <div className="flex flex-col gap-1 flex-1">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname.startsWith(item.href)
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          Sign out
        </button>
      </form>
    </nav>
  )
}
