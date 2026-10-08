# babaloo-dfk-webhook

Shopify `orders/paid` webhook → Drop For Kids API forwarder.

When a customer pays for an order in Babaloo (babaloo.shop), Shopify sends the full order payload to this service. The service verifies the Shopify HMAC signature, maps each line-item SKU to a DFK `productId`, and forwards the order to the Drop For Kids API.

---

## Architecture

```
Shopify (orders/paid event)
        │
        ▼  POST /webhook/shopify/orders-paid
babaloo-dfk-webhook (Cloud Run)
        │  verifies HMAC
        │  checks DFK /health
        │  maps SKUs → DFK productIds
        ▼
Drop For Kids API  →  POST /v1/orders
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DFK_API_KEY` | yes | DFK Bearer token |
| `SHOPIFY_WEBHOOK_SECRET` | yes | Secret shown by Shopify when creating the webhook |
| `PORT` | no | Listening port (default: `8080`) |

---

## Deploy to Google Cloud Run

### Prerequisites

- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated
- A GCP project with Cloud Run, Cloud Build, and Artifact Registry enabled
- Your DFK API key and Shopify webhook secret ready

### 1 — Set project variables

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="europe-central2"
export SERVICE_NAME="babaloo-dfk-webhook"
export IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
```

### 2 — Build and push the Docker image

```bash
gcloud builds submit \
  --tag "${IMAGE}" \
  --project "${PROJECT_ID}"
```

### 3 — Deploy to Cloud Run

```bash
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "DFK_API_KEY=YOUR_DFK_API_KEY_HERE,SHOPIFY_WEBHOOK_SECRET=YOUR_SHOPIFY_SECRET_HERE" \
  --project "${PROJECT_ID}"
```

The command prints a **Service URL** like:
```
https://babaloo-dfk-webhook-xxxxxxxx-lz.a.run.app
```

Save that URL — you will paste it into Shopify in the next step.

### 4 — Verify the health endpoint

```bash
curl https://YOUR_CLOUD_RUN_URL/health
# Expected: {"status":"healthy"}
```

---

## Configure the Shopify webhook

1. Open **Shopify Admin** → **Settings** → **Notifications** → **Webhooks**
2. Click **Create webhook**
3. Fill in:
   - **Event**: `Order payment` (triggers on `orders/paid`)
   - **Format**: `JSON`
   - **URL**: `https://YOUR_CLOUD_RUN_URL/webhook/shopify/orders-paid`
   - **Webhook API version**: `2024-01` (or latest)
4. Click **Save webhook**
5. Shopify will show the **Signing secret** — copy it
6. Re-deploy (or update) the Cloud Run service with that secret:
   ```bash
   gcloud run services update "${SERVICE_NAME}" \
     --region "${REGION}" \
     --update-env-vars "SHOPIFY_WEBHOOK_SECRET=PASTE_SECRET_HERE" \
     --project "${PROJECT_ID}"
   ```
7. Back in Shopify, click **Send test notification** — the webhook should return `200 OK`

---

## Update environment variables without redeploying the image

```bash
gcloud run services update "${SERVICE_NAME}" \
  --region "${REGION}" \
  --update-env-vars "DFK_API_KEY=NEW_KEY,SHOPIFY_WEBHOOK_SECRET=NEW_SECRET" \
  --project "${PROJECT_ID}"
```

---

## SKU mapping

110 Bobono SKUs are hard-coded in `src/skuMapping.ts`:

- **ROZMK** (rozki miekkie) — 49 SKUs
- **ROZSZT** (rozki usztywniane 2w1) — 10 SKUs
- **FASOLKA** (poduszki do karmienia) — 51 SKUs

SKU comparison ignores whitespace, so `"ROZMK/basic/ 551"` and `"ROZMK/basic/551"` resolve to the same product.

If a line-item SKU is **not** in the mapping, the service logs a warning and skips that item (other items in the same order are still forwarded). The DFK order comment will list unmapped SKUs for manual follow-up.

---

## Error handling

| DFK response | Action |
|---|---|
| `201` | Order created, log `orderId` |
| `409 CLIENT_ORDER_IN_PROGRESS` | Wait 3 s, retry once with the same `externalOrderId` |
| `409 ORDER_REQUIRES_REVIEW` | Log critical alert, stop automation, contact DFK |
| `400 INVALID_REQUEST` | Log error, do NOT retry |
| `503 LIVE_ORDERS_DISABLED` | Log warning, do NOT forward |
| `5xx / timeout` | Log error (order will be retried by Shopify webhook delivery) |

**Idempotency:** `externalOrderId` is always `BABALOO-{order_number}`. Shopify may retry the webhook; DFK's 409 `CLIENT_ORDER_IN_PROGRESS` handles that safely.

---

## Local development

```bash
npm install
cp .env.example .env          # fill in DFK_API_KEY and SHOPIFY_WEBHOOK_SECRET
npm run dev
```

Test the health endpoint:
```bash
curl http://localhost:8080/health
```

---

## Project structure

```
src/
  index.ts        — Express app, HMAC verification, webhook handler
  dfkClient.ts    — DFK API client (health check, order creation)
  skuMapping.ts   — 110 SKU → productId mappings + resolver
  shopifyTypes.ts — Shopify webhook payload types
Dockerfile
README.md
tsconfig.json
package.json
```
