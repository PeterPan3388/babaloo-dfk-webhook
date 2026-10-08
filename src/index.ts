import express, { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { resolveProductId } from "./skuMapping";
import {
  checkHealth,
  createOrder,
  DfkLiveOrdersDisabledError,
  DfkRequiresReviewError,
  DfkInvalidRequestError,
  DfkOrderItem,
  DfkRecipient,
} from "./dfkClient";
import type { ShopifyOrder } from "./shopifyTypes";

const app = express();
const PORT = parseInt(process.env.PORT ?? "8080", 10);

// ─── Raw body capture for HMAC verification ──────────────────────────────────
app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ─── Health endpoint ──────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "healthy" });
});

// ─── Shopify webhook: orders/paid ─────────────────────────────────────────────
app.post(
  "/webhook/shopify/orders-paid",
  async (req: Request & { rawBody?: Buffer }, res: Response, next: NextFunction) => {
    // 1. Verify Shopify HMAC signature
    const shopifySecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!shopifySecret) {
      console.error("[Webhook] SHOPIFY_WEBHOOK_SECRET is not set");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    const hmacHeader = req.headers["x-shopify-hmac-sha256"] as string | undefined;
    if (!hmacHeader) {
      console.warn("[Webhook] Missing X-Shopify-Hmac-Sha256 header");
      res.status(401).json({ error: "Missing HMAC header" });
      return;
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      console.warn("[Webhook] Empty body");
      res.status(400).json({ error: "Empty body" });
      return;
    }

    const digest = crypto
      .createHmac("sha256", shopifySecret)
      .update(rawBody)
      .digest("base64");

    const signaturesMatch = crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(hmacHeader)
    );

    if (!signaturesMatch) {
      console.warn("[Webhook] HMAC verification failed");
      res.status(401).json({ error: "HMAC verification failed" });
      return;
    }

    // 2. Parse the Shopify order payload
    const order: ShopifyOrder = req.body;
    const externalOrderId = `BABALOO-${order.order_number}`;
    console.log(`[Webhook] Received order ${externalOrderId} (Shopify id: ${order.id})`);

    // Respond 200 to Shopify immediately to prevent retries while we process
    res.status(200).json({ received: true, externalOrderId });

    // 3. Process asynchronously (after 200 is already sent)
    processOrder(order, externalOrderId).catch((err) => {
      console.error(`[Webhook] Unhandled error processing ${externalOrderId}:`, err);
    });
  }
);

// ─── Core order processing ────────────────────────────────────────────────────
async function processOrder(order: ShopifyOrder, externalOrderId: string): Promise<void> {
  try {
    // 3a. Check DFK health before sending
    let health;
    try {
      health = await checkHealth();
    } catch (err) {
      console.error(`[${externalOrderId}] DFK health check failed:`, err);
      return;
    }

    if (!health.ok) {
      console.error(`[${externalOrderId}] DFK API not healthy — skipping`);
      return;
    }

    if (!health.liveOrders) {
      console.warn(
        `[${externalOrderId}] DFK liveOrders=false — orders disabled, not forwarding`
      );
      return;
    }

    // 3b. Map line items to DFK products
    const dfkItems: DfkOrderItem[] = [];
    const unmappedSkus: string[] = [];

    for (const item of order.line_items) {
      const sku = item.sku ?? "";
      const productId = resolveProductId(sku);

      if (productId === null) {
        console.warn(
          `[${externalOrderId}] SKU not mapped: "${sku}" (${item.title}) — skipping item`
        );
        unmappedSkus.push(sku);
        continue;
      }

      dfkItems.push({ productId, quantity: item.quantity, options: [] });
    }

    if (dfkItems.length === 0) {
      console.error(
        `[${externalOrderId}] No mappable DFK items found. ` +
          `Unmapped SKUs: ${unmappedSkus.join(", ")}. Order NOT forwarded.`
      );
      return;
    }

    // 3c. Build recipient from shipping_address (fallback to billing_address)
    const addr = order.shipping_address ?? order.billing_address;
    if (!addr) {
      console.error(
        `[${externalOrderId}] No shipping or billing address found — order NOT forwarded`
      );
      return;
    }

    const recipient: DfkRecipient = {
      firstName: addr.first_name,
      lastName: addr.last_name,
      street: addr.address1,
      postalCode: addr.zip,
      city: addr.city,
      countryId: 170,
      phone: addr.phone ?? order.phone ?? undefined,
      email: order.email ?? undefined,
    };

    // 3d. Build comment about unmapped items (if any)
    const comment =
      unmappedSkus.length > 0
        ? `Unmapped SKUs (manual action needed): ${unmappedSkus.join(", ")}`
        : undefined;

    // 3e. Send to DFK
    const dfkPayload = {
      externalOrderId,
      items: dfkItems,
      recipient,
      shipping: "own_label" as const,
      payment: "banktransfer" as const,
      ...(comment ? { comment } : {}),
    };

    console.log(`[${externalOrderId}] Sending to DFK:`, JSON.stringify(dfkPayload));

    const response = await createOrder(dfkPayload);
    console.log(
      `[${externalOrderId}] DFK order created — orderId: ${response.orderId}, status: ${response.status}`
    );

    if (unmappedSkus.length > 0) {
      console.warn(
        `[${externalOrderId}] Order forwarded with ${unmappedSkus.length} unmapped SKU(s). ` +
          `Manual review required for: ${unmappedSkus.join(", ")}`
      );
    }
  } catch (err) {
    if (err instanceof DfkRequiresReviewError) {
      console.error(
        `[${externalOrderId}] DFK requires manual review (ORDER_REQUIRES_REVIEW). ` +
          `STOP AUTOMATION — contact Drop For Kids support.`
      );
    } else if (err instanceof DfkLiveOrdersDisabledError) {
      console.error(
        `[${externalOrderId}] DFK live orders are disabled. Order NOT forwarded.`
      );
    } else if (err instanceof DfkInvalidRequestError) {
      console.error(
        `[${externalOrderId}] DFK rejected the request (INVALID_REQUEST): ${err.message}. ` +
          `Do NOT retry without fixing the payload.`
      );
    } else {
      console.error(`[${externalOrderId}] Unexpected error forwarding to DFK:`, err);
    }
  }
}

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Babaloo DFK Webhook listening on port ${PORT}`);
});

export default app;
