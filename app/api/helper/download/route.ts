import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const exePath = path.join(process.cwd(), 'windows-helper', 'installer', 'PeasyHelper-Win10.exe')
  const zipPath = path.join(process.cwd(), 'windows-helper', 'dist', 'PeasyPrint.Helper.zip')
  try {
    // Prefer the installer EXE if present
    const exeData = await fs.readFile(exePath)
    return new NextResponse(exeData, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="PeasyHelper-Win10.exe"',
        'Cache-Control': 'no-store',
      },
    })
  } catch {}

  try {
    // Fallback to ZIP if EXE is not available
    const zipData = await fs.readFile(zipPath)
    return new NextResponse(zipData, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="PeasyPrint.Helper.zip"',
        'Cache-Control': 'no-store',
      },
    })
  } catch {}

  return NextResponse.json({ error: 'Helper not available' }, { status: 404 })
}


