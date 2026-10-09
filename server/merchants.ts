// POC catalogue from Reap's supported merchant list. Live sandbox availability is not guaranteed.
export type Product = {
  id: string;
  merchant: string;
  name: string;
  category: string;
  tier: "lowest" | "best";
  priceCents: number;
  currency: "SGD";
  // Pin a Reap variant id (e.g. the exact size/colour) once known; otherwise resolved via product search.
  variantId?: string;
  // Optional product photo URL. Leave unset to show the built-in illustration.
  imageUrl?: string;
  // Illustrative item that only exists in the local simulator (not purchasable via Reap).
  demoOnly?: boolean;
};

export const CATALOGUE: Product[] = [
  {
    id: "sixeleven-cococoast-500ml",
    merchant: "Six Eleven",
    name: "CocoCoast Chocolate Coconut Water 500ml",
    category: "Grocery & Pantry",
    tier: "lowest",
    priceCents: 385,
    currency: "SGD",
  },
  {
    id: "kydra-axis-linerless-shorts-navy-m",
    merchant: "Kydra",
    name: "Axis Linerless Shorts, Navy / M",
    category: "Fashion & Apparel",
    tier: "best",
    priceCents: 5800,
    currency: "SGD",
  },
];

// Extra illustrative items across price bands so the spending cap visibly changes what the AI can suggest.
// They exist only in the local simulator (or when ENABLE_DEMO_CATALOGUE=true): Reap can't check them out.
const demo = (id: string, merchant: string, name: string, category: string, priceCents: number): Product => ({
  id: `demo-${id}`,
  merchant,
  name,
  category,
  tier: priceCents < 3000 ? "lowest" : "best",
  priceCents,
  currency: "SGD",
  demoOnly: true,
});

export const DEMO_EXTRAS: Product[] = [
  demo("isotonic", "Demo Mart", "Isotonic Sports Drink 500ml", "Grocery & Pantry", 250),
  demo("protein-bar", "Demo Mart", "High-Protein Snack Bar", "Grocery & Pantry", 390),
  demo("sports-towel", "Demo Sports", "Quick-Dry Sports Towel", "Fitness Accessories", 1200),
  demo("water-bottle", "Demo Sports", "Insulated Water Bottle 750ml", "Fitness Accessories", 1800),
  demo("running-socks", "Demo Sports", "Running Socks 3-Pack", "Fashion & Apparel", 2200),
  demo("resistance-bands", "Demo Sports", "Resistance Band Set", "Fitness Accessories", 2500),
  demo("running-cap", "Demo Sports", "Lightweight Running Cap", "Fashion & Apparel", 2900),
  demo("yoga-mat", "Demo Sports", "Non-Slip Yoga Mat", "Fitness Accessories", 4500),
  demo("earbuds", "Demo Audio", "Sweat-Proof Wireless Earbuds", "Electronics", 8900),
  demo("running-shoes", "Demo Sports", "Everyday Running Shoes", "Footwear", 13900),
  demo("smartwatch", "Demo Audio", "Fitness Smartwatch", "Electronics", 24900),
  demo("premium-shoes", "Demo Sports", "Premium Carbon Running Shoes", "Footwear", 32900),
];

// Live Reap mode only offers products that can really be checked out, unless demo items are switched on.
export function getCatalogue(): Product[] {
  const live = Boolean(process.env.REAP_API_KEY);
  const withDemo = !live || process.env.ENABLE_DEMO_CATALOGUE === "true";
  return withDemo ? [...CATALOGUE, ...DEMO_EXTRAS] : CATALOGUE;
}

export const findProduct = (id: string) => getCatalogue().find((p) => p.id === id);
