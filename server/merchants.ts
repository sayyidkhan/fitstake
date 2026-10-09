// POC catalogue from Reap's supported merchant list. Live sandbox availability is not guaranteed.
export type Product = {
  id: string;
  merchant: string;
  name: string;
  category: string;
  tier: "lowest" | "best";
  priceCents: number;
  currency: "SGD";
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

export const findProduct = (id: string) => CATALOGUE.find((p) => p.id === id);
