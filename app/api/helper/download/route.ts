import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'windows-helper', 'dist', 'PeasyPrint.Helper.zip')
    const data = await fs.readFile(filePath)
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="PeasyPrint.Helper.zip"',
        'Cache-Control': 'no-store',
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Helper not available' }, { status: 404 })
  }
}


