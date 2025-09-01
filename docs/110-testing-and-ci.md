### Purpose
Testing strategy and CI pipeline.

### At a glance
- Unit, integration, and E2E coverage; mocks for Auth/Admin/Razorpay.

### Unit tests
- pricing.ts deterministic cases (see docs/60-pricing-engine.md).
- utils: upload fallback logic.

### Integration tests (API)
- `/api/razorpay/order` with fake Razorpay client.
- `/api/razorpay/verify` HMAC vectors.
- `/api/storage/upload` mocked Admin SDK.

### E2E (Playwright)
- Login → Upload → Pay (mocked) → Verify → Order appears in Firestore (emulator).

### Mocks
- Clerk: stub session in request context.
- Firebase Admin: jest.mock with in-memory maps.
- Razorpay: stub `orders.create`.

### CI pipeline (GitHub Actions)
```yaml
name: CI
on: [push, pull_request]
jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 18 }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
  deploy:
    needs: build-test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

### Gating rules deploy
- Add step to validate `firestore.rules`, `storage.rules`, and deploy indexes in staging before prod cutover.


