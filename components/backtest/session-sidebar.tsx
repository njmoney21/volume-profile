'use client'

import { formatDate } from '@/lib/utils'
import type { BacktestSession } from '@/types'

interface SessionSidebarProps {
  sessions: BacktestSession[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

export function SessionSidebar({ sessions, selectedId, onSelect, onNew }: SessionSidebarProps) {
  return (
    <div className="w-64 shrink-0 bg-black border border-white/10 rounded-xl p-3 flex flex-col gap-2">
      <button onClick={onNew}
        className="w-full px-4 py-2 text-sm bg-white hover:bg-gray-200 text-black rounded-lg transition-colors">
        + New Session
      </button>

      <div className="flex flex-col gap-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No sessions yet. Create one to get started.
          </p>
        ) : (
          sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                session.id === selectedId
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <div>
                {formatDate(session.date_from)} – {formatDate(session.date_to)}
              </div>
              {session.notes && (
                <div className="text-xs text-gray-500 truncate">{session.notes}</div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
