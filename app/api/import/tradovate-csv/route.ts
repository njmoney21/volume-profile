import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseFillsCsv } from '@/lib/tradovate/parseFillsCsv'
import { runImport } from '@/lib/tradovate/runImport'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing CSV file' }, { status: 400 })
    }

    const csvText = await file.text()
    const { fills, pointValueByContract, skippedSymbols } = parseFillsCsv(csvText)

    const admin = createAdminClient()
    const { imported, stillOpen } = await runImport(fills, pointValueByContract, admin)
    const skipped = fills.filter(f => !pointValueByContract.has(f.contractId)).length

    return NextResponse.json({ imported, stillOpen, skipped, skippedSymbols })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown import error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
