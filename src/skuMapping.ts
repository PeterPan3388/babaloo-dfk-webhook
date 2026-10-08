// SKU Shopify → productId Drop For Kids
// Source: spaces/maliaki/google-shopping/dfk-sku-mapping.md
// Generated: 2026-10-08 | 110 SKU total

export const SKU_TO_PRODUCT_ID: Record<string, number> = {
  // ─── Rozek miekki (ROZMK) — 49 SKU ─────────────────────────────────────
  "ROZMK/285": 102,
  "ROZMK/259": 103,
  "ROZMK/361": 104,
  "ROZMK/basic/ 551": 522,
  "ROZMK/basic/ 552": 523,
  "ROZMK/basic/ 553": 524,
  "ROZMK/556": 544,
  "ROZMK/basic/ 557": 545,
  "ROZMK/basic/ 701": 604,
  "ROZMK/basic/ 528": 631,
  "ROZMK/basic/ 535": 638,
  "ROZMK/basic/ 578": 639,
  "ROZMK/basic/ 581": 640,
  "ROZMK/basic/ 583": 717,
  "ROZMK/basic/ 584": 718,
  "ROZMK/basic/ 588": 866,
  "ROZMK/colormix/ 738": 872,
  "ROZMK/basic/ 746": 918,
  "ROZMK/basic/ 749": 919,
  "ROZMK/basic/301": 1054,
  "ROZMK/basic/302": 1055,
  "ROZMK/basic/ 303": 1056,
  "ROZMK/basic/305": 1057,
  "ROZMK/basic/306": 1058,
  "ROZMK/basic/300": 1059,
  "ROZMK/goodnight/806": 1060,
  "ROZMK/goodnight/808": 1061,
  "ROZMK/goodnight/810": 1062,
  "ROZMK/goodnight/811": 1063,
  "ROZMK/simple/ 571": 1064,
  "ROZMK/simple/ 576": 1065,
  "ROZMK/basic/ 586": 1080,
  "ROZMK/basic/ 550": 1081,
  "ROZMK/basic/ 534": 1082,
  "ROZMK/basic/ 533": 1083,
  "ROZMK/basic/ 532": 1084,
  "ROZMK/basic/ 531": 1085,
  "ROZMK/basic/ 530": 1086,
  "ROZMK/basic/ 529": 1087,
  "ROZMK/basic/ 527": 1088,
  "ROZMK/basic/ 526": 1089,
  "ROZMK/525": 1090,
  "ROZMK/basic/ 524": 1091,
  "ROZMK/basic/ 523": 1092,
  "ROZMK/basic/ 522": 1093,
  "ROZMK/basic/ 521": 1094,
  "ROZMK/basic/ 520": 1095,
  "ROZMK/basic/ 519": 1096,
  "ROZMK/basic/ 518": 1097,
  "ROZMK/basic/ 517": 1098,

  // ─── Rozek usztywniany 2w1 (ROZSZT) — 10 SKU ────────────────────────────
  "ROZSZT-531": 106,
  "ROZSZT/525": 107,
  "ROZSZT/524": 108,
  "ROZSZT/228": 109,
  "ROZSZT/basic/146": 110,
  "ROZSZT/basic/165": 111,
  "ROZSZT/basic/285": 112,
  "ROZSZT/basic/259": 113,
  "ROZSZT/basic/361": 114,
  "ROZSZT/basic/549": 115,

  // ─── Poduszka Fasolka (FASOLKA) — 51 SKU ────────────────────────────────
  "FASOLKA-123": 116,
  "FASOLKA-518": 117,
  "FASOLKA-519": 118,
  "FASOLKA-521": 119,
  "FASOLKA-522": 120,
  "FASOLKA-531": 121,
  "FASOLKA-525": 124,
  "FASOLKA-524": 125,
  "FASOLKA-228": 126,
  "FASOLKA-220": 127,
  "FASOLKA-361": 131,
  "FASOLKA- 524": 125,
  "FASOLKA-329": 132,
  "FASOLKA-548": 133,
  "FASOLKA-549": 134,
  "FASOLKA-545": 135,
  "FASOLKA-547": 136,
  "FASOLKA-517": 171,
  "FASOLKA-523": 172,
  "FASOLKA-529": 175,
  "FASOLKA-530": 176,
  "FASOLKA-534": 178,
  "FASOLKA-811": 374,
  "FASOLKA-550": 507,
  "FASOLKA-551": 508,
  "FASOLKA-552": 509,
  "FASOLKA-553": 510,
  "FASOLKA-554": 540,
  "FASOLKA-555": 541,
  "FASOLKA- 556": 542,
  "FASOLKA-565": 603,
  "FASOLKA-562": 607,
  "FASOLKA-701": 609,
  "FASOLKA-707": 610,
  "FASOLKA-710": 611,
  "FASOLKA-711": 612,
  "FASOLKA-567": 613,
  "FASOLKA-569": 615,
  "FASOLKA-570": 616,
  "FASOLKA-573": 617,
  "FASOLKA-574": 618,
  "FASOLKA-575": 619,
  "FASOLKA-578": 656,
  "FASOLKA-579": 657,
  "FASOLKA-581": 658,
  "FASOLKA-576": 681,
  "FASOLKA-583": 736,
  "FASOLKA-720": 818,
  "FASOLKA-723": 819,
  "FASOLKA-587": 821,
};

/**
 * Resolve a Shopify SKU to a DFK productId.
 * Strips all whitespace before comparison to handle variants like
 * "ROZMK/basic/ 551" vs "ROZMK/basic/551".
 */
export function resolveProductId(sku: string): number | null {
  // 1. Exact match first
  if (SKU_TO_PRODUCT_ID[sku] !== undefined) {
    return SKU_TO_PRODUCT_ID[sku];
  }
  // 2. Whitespace-normalised match (strip all spaces)
  const normalised = sku.replace(/\s+/g, "");
  for (const [key, id] of Object.entries(SKU_TO_PRODUCT_ID)) {
    if (key.replace(/\s+/g, "") === normalised) {
      return id;
    }
  }
  return null;
}
