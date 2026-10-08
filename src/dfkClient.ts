import axios, { AxiosError } from "axios";

const DFK_BASE_URL = "https://dfk-connector-847778530701.europe-central2.run.app";

export interface DfkOrderItem {
  productId: number;
  quantity: number;
  options: never[];
}

export interface DfkRecipient {
  firstName: string;
  lastName: string;
  street: string;
  postalCode: string;
  city: string;
  countryId?: number;
  phone?: string;
  email?: string;
}

export interface DfkOrderPayload {
  externalOrderId: string;
  items: DfkOrderItem[];
  recipient: DfkRecipient;
  shipping?: string;
  payment?: string;
  comment?: string;
}

export interface DfkOrderResponse {
  orderId: string;
  status: string;
  externalOrderId: string;
  state: string;
  createdAt: string;
}

export interface DfkHealthResponse {
  ok: boolean;
  liveOrders: boolean;
}

function getAuthHeaders() {
  const apiKey = process.env.DFK_API_KEY;
  if (!apiKey) throw new Error("DFK_API_KEY environment variable is not set");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export async function checkHealth(): Promise<DfkHealthResponse> {
  const resp = await axios.get<DfkHealthResponse>(`${DFK_BASE_URL}/health`, {
    headers: getAuthHeaders(),
    timeout: 10_000,
  });
  return resp.data;
}

/** Send an order to DFK. Returns the created order on success. */
export async function createOrder(
  payload: DfkOrderPayload,
  retryOnInProgress = true
): Promise<DfkOrderResponse> {
  try {
    const resp = await axios.post<DfkOrderResponse>(
      `${DFK_BASE_URL}/v1/orders`,
      payload,
      { headers: getAuthHeaders(), timeout: 15_000 }
    );
    return resp.data;
  } catch (err) {
    const axErr = err as AxiosError<{ code?: string; message?: string }>;
    const status = axErr.response?.status;
    const code = axErr.response?.data?.code;

    if (status === 409 && code === "CLIENT_ORDER_IN_PROGRESS") {
      if (!retryOnInProgress) throw err;
      console.log(
        `[DFK] 409 CLIENT_ORDER_IN_PROGRESS for ${payload.externalOrderId}, retrying in 3 s...`
      );
      await new Promise((r) => setTimeout(r, 3_000));
      return createOrder(payload, false);
    }

    if (status === 409 && code === "ORDER_REQUIRES_REVIEW") {
      throw new DfkRequiresReviewError(payload.externalOrderId);
    }

    if (status === 503) {
      throw new DfkLiveOrdersDisabledError();
    }

    if (status === 400) {
      throw new DfkInvalidRequestError(
        axErr.response?.data?.message ?? "INVALID_REQUEST"
      );
    }

    throw err;
  }
}

export class DfkRequiresReviewError extends Error {
  constructor(public readonly externalOrderId: string) {
    super(`ORDER_REQUIRES_REVIEW: ${externalOrderId}`);
    this.name = "DfkRequiresReviewError";
  }
}

export class DfkLiveOrdersDisabledError extends Error {
  constructor() {
    super("LIVE_ORDERS_DISABLED");
    this.name = "DfkLiveOrdersDisabledError";
  }
}

export class DfkInvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DfkInvalidRequestError";
  }
}
