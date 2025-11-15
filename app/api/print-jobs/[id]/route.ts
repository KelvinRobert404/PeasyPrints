import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'

function ensureAdminInit() {
  if (admin.apps && admin.apps.length > 0) return
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin envs')
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  })
}

function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}

function badRequest(message = 'Bad Request') {
  return NextResponse.json({ error: message }, { status: 400 })
}

function notFound(message = 'Not Found') {
  return NextResponse.json({ error: message }, { status: 404 })
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Optional Bearer token auth for the helper
    const expected = process.env.PEASYPRINT_API_KEY
    if (expected && expected.length > 0) {
      const authz = req.headers.get('authorization') || ''
      const token = authz.toLowerCase().startsWith('bearer ')
        ? authz.slice(7)
        : ''
      if (token !== expected) {
        return unauthorized()
      }
    }

    const { id: jobId } = await params
    if (!jobId) return badRequest('Missing job id')

    // Dev fallback: if Firebase Admin envs are not present, return a test payload for local E2E
    const hasAdminEnvs = Boolean(
      process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY
    )
    if (!hasAdminEnvs) {
      console.warn('[print-jobs] Using dev fallback response; Firebase Admin envs missing')
      const fallbackUrl = process.env.PEASYPRINT_DEV_FILE_URL || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      const res = NextResponse.json({ fileUrl: fallbackUrl, copies: 1, isColor: true })
      res.headers.set('Cache-Control', 'no-store')
      return res
    }

    ensureAdminInit()

    // Look up the order by id (jobId maps to Firestore orders doc id)
    const ref = admin.firestore().collection('orders').doc(jobId)
    const snap = await ref.get()
    if (!snap.exists) return notFound('Job not found')
    const data = snap.data() as any

    // Derive fields
    const copies = Math.max(Number(data?.printSettings?.copies || 1), 1)
    const isColor = String(data?.printSettings?.printColor || '').toLowerCase().includes('color')

    // Prefer provided fileUrl; if it points to Firebase Storage, re-sign a fresh, short-lived URL
    let fileUrl: string = String(
      (data?.splitFiles && (isColor ? data.splitFiles.colorUrl : data.splitFiles.bwUrl)) ||
      data?.fileUrl ||
      ''
    )
    if (!fileUrl) return badRequest('No file URL on job')

    try {
      // Attempt to detect Firebase Storage download URL and convert to signed URL with short TTL
      // Example: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?alt=media&token=...
      const storageMatch = fileUrl.match(/firebasestorage.googleapis.com\/v0\/b\/([^/]+)\/o\/([^?]+)/i)
      if (storageMatch) {
        const bucket = decodeURIComponent(storageMatch[1])
        const objectPath = decodeURIComponent(storageMatch[2])
        const expires = Date.now() + 10 * 60 * 1000 // 10 minutes
        const [signed] = await admin
          .storage()
          .bucket(bucket)
          .file(objectPath)
          .getSignedUrl({ action: 'read', expires })
        if (signed) fileUrl = signed
      }
    } catch {
      // Fall back to original URL if signing fails
    }

    const res = NextResponse.json({ fileUrl, copies, isColor })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e: any) {
    const message = process.env.NODE_ENV !== 'production' ? (e?.stack || e?.message || String(e)) : 'Failed to fetch print job'
    console.error('[print-jobs] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}



