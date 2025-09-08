import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'
import crypto from 'crypto'
import { captureServerEvent } from '@/lib/posthog/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Initialize Admin SDK
    // @ts-ignore
    if (!(admin as any).apps || (admin as any).apps.length === 0) {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
      if (!projectId || !clientEmail || !privateKey) {
        return NextResponse.json({ error: 'Server is not configured' }, { status: 500 })
      }
      admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) })
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Server is not configured' }, { status: 500 })
    }

    const payloadText = await req.text()
    const signature = req.headers.get('x-razorpay-signature') || ''
    const expected = crypto.createHmac('sha256', webhookSecret).update(payloadText).digest('hex')
    // timing-safe compare to avoid subtle leaks
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      captureServerEvent({ event: 'error', properties: { source: 'razorpay_webhook', reason: 'invalid_signature' } })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(payloadText)
    const bodyHash = crypto.createHash('sha256').update(payloadText).digest('hex')
    const dedupeRef = admin.firestore().collection('razorpay_webhook_events').doc(bodyHash)
    try {
      await dedupeRef.create({
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        eventType: event?.event || null,
        accountId: event?.account_id || null,
        createdAt: event?.created_at || null
      })
    } catch (err: any) {
      // Duplicate delivery (Razorpay retries). Ack 200 to stop further retries
      if (String(err?.code) === '6' || String(err?.code).toLowerCase() === 'already_exists' || String(err?.message || '').toLowerCase().includes('already exists')) {
        captureServerEvent({ event: 'error', properties: { severity: 'info', source: 'razorpay_webhook', reason: 'duplicate_event', bodyHash } })
        const res = NextResponse.json({ ok: true, duplicate: true })
        res.headers.set('Cache-Control', 'no-store')
        return res
      }
      // Unknown failure while creating dedupe doc: continue, but log
      captureServerEvent({ event: 'error', properties: { source: 'razorpay_webhook', reason: 'dedupe_create_failed', error: String(err?.message || err) } })
    }
    const type = event?.event as string
    const entity = event?.payload?.payment?.entity || event?.payload?.order?.entity
    if (!type || !entity) {
      return NextResponse.json({ ok: true })
    }

    if (type === 'payment.captured' || type === 'order.paid') {
      const orderId = entity.order_id || entity.id
      const paymentId = entity.id
      if (orderId && paymentId) {
        const ref = admin.firestore().collection('payments').doc(orderId)
        await admin.firestore().runTransaction(async (tx) => {
          const snap = await tx.get(ref)
          if (!snap.exists) return
          const data = snap.data() as any
          if (data.status === 'paid') return
          tx.update(ref, {
            status: 'paid',
            razorpay_payment_id: paymentId,
            webhookVerifiedAt: admin.firestore.FieldValue.serverTimestamp()
          })
        })
        // Server-side analytics
        captureServerEvent({ event: 'razorpay_payment_succeeded', properties: { razorpay_order_id: orderId, razorpay_payment_id: paymentId, status: 'paid' } })
        try { await dedupeRef.set({ processedAt: admin.firestore.FieldValue.serverTimestamp(), status: 'processed', orderId, paymentId }, { merge: true }) } catch {}
      }
    }
    else if (type === 'payment.failed') {
      const orderId = entity.order_id || entity.id
      const paymentId = entity.id
      if (orderId && paymentId) {
        try {
          const ref = admin.firestore().collection('payments').doc(orderId)
          await admin.firestore().runTransaction(async (tx) => {
            const snap = await tx.get(ref)
            if (!snap.exists) return
            const data = snap.data() as any
            if (data.status === 'paid') return
            tx.update(ref, {
              status: 'failed',
              razorpay_payment_id: paymentId,
              webhookFailedAt: admin.firestore.FieldValue.serverTimestamp()
            })
          })
        } catch {}
        captureServerEvent({ event: 'razorpay_payment_failed', properties: { razorpay_order_id: orderId, razorpay_payment_id: paymentId, status: 'failed' } })
        try { await dedupeRef.set({ processedAt: admin.firestore.FieldValue.serverTimestamp(), status: 'processed', orderId, paymentId }, { merge: true }) } catch {}
      }
    } else {
      // Unknown/unhandled events: soft-log for observability
      captureServerEvent({ event: 'error', properties: { severity: 'info', source: 'razorpay_webhook', unhandled_event_type: String(type) } })
      try { await dedupeRef.set({ processedAt: admin.firestore.FieldValue.serverTimestamp(), status: 'ignored' }, { merge: true }) } catch {}
    }

    const res = NextResponse.json({ ok: true })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e: any) {
    return NextResponse.json({ error: 'Webhook handling failed' }, { status: 500 })
  }
}


