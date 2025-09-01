### Purpose
Contract for all Next.js route handlers.

### At a glance
- All endpoints JSON-based, authenticated via Clerk middleware where applicable.
- Use correlation-id header for tracing.

---

#### POST /api/storage/upload
- Auth: Clerk session required (recommend validating on client/server)
- Runtime: Node
- Request: multipart/form-data with fields: `file`, `userId`
- Response:
```ts
type UploadResponse = { url: string; path: string };
type ErrorResponse = { error: string };
```
- Example:
```http
POST /api/storage/upload
Content-Type: multipart/form-data

file=@thesis.pdf
userId=u_123
```
```json
{ "url": "https://firebasestorage.googleapis.com/.../uploads/u_123/...", "path": "uploads/u_123/..." }
```
- Errors: 400 (bad input), 500 (server error)
- Idempotency: N/A; filenames include timestamp

---

#### POST /api/razorpay/order
- Auth: User session (Clerk)
- Runtime: Dynamic (serverless)
- Request:
```ts
type CreateOrderRequest = { amount: number; currency?: 'INR'; receipt?: string };
type CreateOrderResponse = { order: { id: string; amount: number; currency: string; receipt: string } };
```
- Example:
```json
{ "amount": 860, "currency": "INR", "receipt": "u_123_1709999999" }
```
- Errors: 400 (invalid amount), 500 (keys not configured)
- Idempotency: Provide unique `receipt` per logical purchase

---

#### POST /api/razorpay/verify
- Auth: User session (Clerk)
- Runtime: Node (cryptography)
- Request:
```ts
type VerifyRequest = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type VerifyResponse = { valid: boolean };
```
- Example:
```json
{ "razorpay_order_id": "order_ABC", "razorpay_payment_id": "pay_DEF", "razorpay_signature": "sig_XYZ" }
```
- Errors: 400 (invalid signature), 500 (server error)
- Idempotency: Store processed `payment_id` to prevent replay (TODO)

---

#### POST /api/users/upsert
- Auth: Clerk session (server verifies)
- Runtime: Node (Admin SDK)
- Request: none (server derives identity from Clerk)
- Response: `{ ok: true }`
- Errors: 401 (unauthorized), 500 (server error)

---

#### POST /api/auth/firebase-custom-token
- Auth: Clerk session
- Runtime: Node (Admin SDK)
- Response:
```ts
type CustomTokenResponse = { token: string };
```
- Errors: 401 (unauthorized), 500

### Error codes and retry policy
| Code | Meaning | Retry |
| --- | --- | --- |
| 400 | Client error/validation | No |
| 401 | Unauthorized | After login |
| 500 | Server failure | Exponential backoff (3 tries) |


