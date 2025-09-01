### Purpose
PWA strategy, caching, and offline UX.

### At a glance
- Service worker registered; selected assets precached.
- Uploads and payments require connectivity; provide guardrails.

### Service worker
- `service-worker.js`/`public/sw.js` registers and precaches static assets.
- Version assets by hash; invalidate on deploy.

### Caching
- Precache: fonts, icons, pdf worker, CSS, core JS chunks.
- Runtime cache: images with stale-while-revalidate.
- API routes: no-cache.

### Offline UX
- Upload: disable file submission while offline; queue not supported (Assumption).
- Payments: block checkout offline; show retry CTA.

### Background sync
- Consider adding Background Sync for re-upload attempts (constraints: user gesture and browser support).

### TODO
- Add "Try again" banner when connectivity restored (Network Information API).


