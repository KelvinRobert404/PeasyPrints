import { NextRequest, NextResponse } from 'next/server'
import { auth as clerkAuth } from '@clerk/nextjs/server'
import admin from 'firebase-admin'
import { z } from 'zod'
import { captureServerEvent } from '@/lib/posthog/server'
import type { PrintJobType } from '@/types/models'
export const runtime = 'nodejs'
import { isAllowedOrigin } from '@/lib/utils/origin'

const CreateOrderSchema = z.object({
  shopId: z.string().min(1),
  shopName: z.string().optional(),
  userName: z.string().optional(),
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
  totalPages: z.number().int().positive(),
  printSettings: z.object({
    paperSize: z.enum(['A3', 'A4']),
    printFormat: z.enum(['Single-Sided', 'Double-Sided']),
    printColor: z.enum(['Black & White', 'Color']),
    orientation: z.enum(['Vertical', 'Horizontal']),
    binding: z.enum(['Soft Binding', 'Spiral Binding', 'Hard Binding', '']).optional().default(''),
    copies: z.number().int().positive(),
    extraColorPages: z.number().int().min(0).optional().default(0),
    emergency: z.boolean().optional().default(false),
    afterDark: z.boolean().optional().default(false)
  }),
  jobType: z.enum(['PDF', 'Images', 'Assignment']).optional(),
  splitFiles: z.object({ bwUrl: z.string().url(), colorUrl: z.string().url() }).optional(),
  assignment: z.object({ colorPages: z.array(z.number().int().positive()) }).optional()
})

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

    // Auth
    const { userId } = await clerkAuth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // CSRF: same-site/allowlisted check
    if (!isAllowedOrigin(req.url, req.headers.get('origin'), req.headers.get('x-forwarded-host'), req.headers.get('x-forwarded-proto'))) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
    }

    const json = await req.json()
    const parsed = CreateOrderSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    const { shopId, shopName, userName, fileUrl, fileName, totalPages, printSettings, jobType, splitFiles, assignment } = parsed.data

    // Fetch shop pricing
    let shopData: any
    try {
      const shopRef = admin.firestore().collection('shops').doc(shopId)
      const shopSnap = await shopRef.get()
      shopData = shopSnap.data() as any
    } catch (err: any) {
      captureServerEvent({ event: 'order_creation_failed', distinctId: userId, properties: { shopId, stage: 'fetch_shop', error: String(err?.message || err) } })
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({ error: `Failed to create order: ${String(err?.message || '')}` }, { status: 500 })
      }
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }
    const pricing = shopData?.pricing
    if (!pricing) {
      return NextResponse.json({ error: 'Shop pricing unavailable' }, { status: 400 })
    }

    // Compute totals
    // Lightweight inline calc to avoid importing TS-only utils in route
    const isA4 = printSettings.paperSize === 'A4'
    const table = isA4 ? pricing.a4 : pricing.a3
    const perPage = printSettings.printColor === 'Color'
      ? (printSettings.printFormat === 'Double-Sided' ? table.doubleColor : table.singleColor)
      : (printSettings.printFormat === 'Double-Sided' ? table.doubleBW : table.singleBW)
    const bwPerPage = (printSettings.printFormat === 'Double-Sided' ? table.doubleBW : table.singleBW)
    const colorPerPage = (printSettings.printFormat === 'Double-Sided' ? table.doubleColor : table.singleColor)
    const extraColorPages = printSettings.extraColorPages || 0
    const extraColorDelta = Math.max(colorPerPage - bwPerPage, 0) * extraColorPages
    const bindingMap: Record<string, number> = {
      'Soft Binding': pricing.services.softBinding ?? 0,
      'Spiral Binding': pricing.services.spiralBinding ?? 0,
      'Hard Binding': pricing.services.hardBinding ?? 0,
      '': 0
    }
    const bindingCost = bindingMap[printSettings.binding || ''] || 0
    const emergencyUnit = pricing.services.emergency ?? 0
    const afterDarkUnit = pricing.services.afterDark ?? emergencyUnit ?? 0
    const copies = Math.max(printSettings.copies || 1, 1)
    const basePagesCost = perPage * totalPages
    const base = (basePagesCost + bindingCost + (printSettings.printColor === 'Black & White' ? extraColorDelta : 0)) * copies
    const emergencyCost = printSettings.emergency ? emergencyUnit : 0
    const afterDarkCost = printSettings.afterDark ? afterDarkUnit : 0
    const convenienceFee = pricing.convenienceFee ?? 0
    const totalCost = base + emergencyCost + afterDarkCost + convenienceFee

    const orderDoc: any = {
      userId,
      shopId,
      shopName: shopName || shopData?.name || '',
      userName: userName || '',
      fileName,
      fileUrl,
      totalPages,
      totalCost,
      status: 'processing',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      emergency: !!printSettings.emergency,
      afterDark: !!printSettings.afterDark,
      printSettings,
      pricingDetails: {
        basePricePerPage: perPage,
        bindingCost,
        emergencyCost,
        afterDarkCost,
        commission: 0,
        convenienceFee
      }
    }

    if (jobType) orderDoc.jobType = jobType as PrintJobType
    if (splitFiles) orderDoc.splitFiles = splitFiles
    if (assignment) orderDoc.assignment = assignment

    let ref
    try {
      ref = await admin.firestore().collection('orders').add(orderDoc)
    } catch (err: any) {
      captureServerEvent({ event: 'order_creation_failed', distinctId: userId, properties: { shopId, error: String(err?.message || err) } })
      if (process.env.NODE_ENV !== 'production') {
        const msg = String(err?.message || '')
        return NextResponse.json({ error: `Failed to create order: ${msg}` }, { status: 500 })
      }
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }
    captureServerEvent({ event: 'order_created', distinctId: userId, properties: { shopId, totalPages, totalCost } })
    const res = NextResponse.json({ id: ref.id })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}


