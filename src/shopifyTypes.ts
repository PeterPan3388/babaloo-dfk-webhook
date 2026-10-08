// Shopify orders/paid webhook payload — only the fields we use

export interface ShopifyAddress {
  first_name: string;
  last_name: string;
  address1: string;
  zip: string;
  city: string;
  phone?: string;
  country_code?: string;
}

export interface ShopifyLineItem {
  id: number;
  sku: string;
  title: string;
  quantity: number;
  price: string;
}

export interface ShopifyOrder {
  id: number;
  order_number: number;
  name: string; // e.g. "#1005"
  email: string;
  phone?: string;
  shipping_address?: ShopifyAddress;
  billing_address?: ShopifyAddress;
  line_items: ShopifyLineItem[];
}
