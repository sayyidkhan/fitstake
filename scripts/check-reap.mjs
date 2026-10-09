// Read-only connectivity check: no enrolment, card storage, or checkout is created.
const base = process.env.REAP_BASE_URL || "https://sg.sandbox.api.reap.global";
if (
  base !== "https://sg.sandbox.api.reap.global" &&
  base !== "https://sandbox.api.reap.global"
)
  throw new Error("Use a Reap sandbox host for this check.");
if (!process.env.REAP_API_KEY)
  throw new Error("Set REAP_API_KEY in the server-side .env file.");
try {
  const response = await fetch(`${base}/agentic/products/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.REAP_API_KEY}`,
      "Content-Type": "application/json",
      "Reap-Version": process.env.REAP_VERSION || "2025-02-14",
    },
    body: JSON.stringify({
      query: "KYDRA Axis Linerless Shorts",
      context: { country: "SG", currency: "SGD" },
      filters: { availability: "AVAILABLE_ONLY" },
      pagination: { limit: 10 },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => ({}));
  console.log(
    JSON.stringify({
      status: response.status,
      reachable: true,
      productCount: result.products?.length ?? 0,
      errorCode: result.error?.code ?? result.code ?? null,
    }),
  );
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  console.error(
    "Reap sandbox connection failed:",
    error instanceof Error ? error.message : "Request failed",
  );
  process.exitCode = 1;
}
