### Purpose
Logging, metrics, alerting, and DR.

### At a glance
- Client/server logs, correlation IDs, metrics for conversion and payment success.
- Alert on verify failures and upload errors.

### Logging
- Client: `console.error` wrapper sends to a logging endpoint with `x-correlation-id`.
- Server: include `x-correlation-id` echo in responses; log errors with stack.

### Metrics to track
- Upload success rate
- Average upload size and duration
- Payment order creation success rate
- Payment verify success rate
- Order creation latency post-verify
- Shopfront order update latency

### Alerting
- If verify failure rate > 2% in last 15 minutes → page on-call.
- If upload 5xx > 1% → warn.
- Dashboard panels for each metric.

### Backup/restore
- Enable Firestore scheduled exports to GCS.
- Storage: lifecycle rules + backup of critical prefixes (logos optional).
- DR: restore playbook and RTO/RPO targets (RPO 15m, RTO 2h).


