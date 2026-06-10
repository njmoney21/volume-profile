'use client'

import { useState } from 'react'
import type { BacktestSession, BacktestDay, BacktestTrade } from '@/types'
import { deleteSession } from '@/app/backtest/actions'
import { SessionSidebar } from './session-sidebar'
import { SessionForm } from './session-form'
import { SessionDetail } from './session-detail'

interface BacktestClientProps {
  sessions: BacktestSession[]
  days: BacktestDay[]
  trades: BacktestTrade[]
}

export function BacktestClient({ sessions, days, trades }: BacktestClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(sessions[0]?.id ?? null)
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [editingSession, setEditingSession] = useState<BacktestSession | null>(null)

  const selected = sessions.find(s => s.id === selectedId) ?? null

  async function handleDeleteSession(id: string) {
    await deleteSession(id)
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Backtest</h1>
      <div className="flex gap-4 items-start">
        <SessionSidebar
          sessions={sessions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNew={() => { setEditingSession(null); setShowSessionForm(true) }}
        />
        <div className="flex-1">
          {selected ? (
            <SessionDetail
              session={selected}
              days={days.filter(d => d.session_id === selected.id)}
              trades={trades.filter(t => t.session_id === selected.id)}
              onEditSession={() => { setEditingSession(selected); setShowSessionForm(true) }}
              onDeleteSession={() => handleDeleteSession(selected.id)}
            />
          ) : (
            <div className="bg-black border border-white/10 rounded-xl p-8 text-center text-gray-500 text-sm">
              No session selected. Create a session to get started.
            </div>
          )}
        </div>
      </div>

      {showSessionForm && (
        <SessionForm session={editingSession ?? undefined} onClose={() => setShowSessionForm(false)} />
      )}
    </div>
  )
}
