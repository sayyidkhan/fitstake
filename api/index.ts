import { handle } from "hono/vercel";
import { app } from "../server/app.js";

export const config = { runtime: "nodejs" };
// Named method exports tell Vercel to pass a Web Request and send the returned
// Response. A default Node handler expects (req, res) and leaves responses open.
export const GET = handle(app);
export const POST = handle(app);
