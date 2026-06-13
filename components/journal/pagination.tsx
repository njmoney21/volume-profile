export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded-lg text-sm font-medium border border-white/10 text-gray-300 hover:bg-white/5 hover:border-white/20 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-white/10"
      >
        ← Prev
      </button>
      <span className="text-sm text-gray-400 tabular-nums">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 rounded-lg text-sm font-medium border border-white/10 text-gray-300 hover:bg-white/5 hover:border-white/20 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-white/10"
      >
        Next →
      </button>
    </div>
  )
}
