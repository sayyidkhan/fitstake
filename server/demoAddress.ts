// Fixed demo shipping address for the POC. Sandbox checkouts ship nothing.
export const DEMO_SHIPPING_ADDRESS = {
  firstName: "Demo",
  lastName: "Recipient",
  phone: "+6591234567",
  addressLine1: "1 Raffles Place",
  city: "Singapore",
  postalCode: "048616",
  country: "SG",
} as const;
