import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/node";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only these keys can be stored, and only under the caller's own login.
const KEYS = new Set(["book"]);

function kv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(cmd: unknown[]): Promise<unknown> {
  const cfg = kv();
  if (!cfg) throw new Error("storage not configured");
  const r = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!r.ok) throw new Error("storage error");
  return ((await r.json()) as { result: unknown }).result;
}

// Returns the logged-in user's Privy ID, or null if the token is missing or invalid.
async function whoIs(req: NextRequest): Promise<string | null> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!appId || !appSecret || !token) return null;
  try {
    const privy = new PrivyClient({ appId, appSecret });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claims: any = await privy.utils().auth().verifyAccessToken(token);
    return (claims.userId ?? claims.user_id ?? null) as string | null;
  } catch {
    return null;
  }
}

function ready() {
  return !!(kv() && process.env.PRIVY_APP_SECRET && process.env.NEXT_PUBLIC_PRIVY_APP_ID);
}

function cleanBook(value: unknown) {
  if (!Array.isArray(value)) return null;
  return value
    .filter((x) => x && typeof x.name === "string" && typeof x.address === "string" && /^0x[a-fA-F0-9]{40}$/.test(x.address))
    .slice(0, 200)
    .map((x) => ({ name: String(x.name).slice(0, 60), address: x.address }));
}

export async function GET(req: NextRequest) {
  if (!ready()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  const uid = await whoIs(req);
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const key = req.nextUrl.searchParams.get("key") || "";
  if (!KEYS.has(key)) return NextResponse.json({ ok: false, error: "bad key" }, { status: 400 });
  try {
    const raw = await redis(["GET", `cowrie:${uid}:${key}`]);
    return NextResponse.json({ ok: true, value: typeof raw === "string" ? JSON.parse(raw) : null });
  } catch {
    return NextResponse.json({ ok: false, error: "storage" }, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  if (!ready()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  const uid = await whoIs(req);
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const key = body?.key;
  if (typeof key !== "string" || !KEYS.has(key)) return NextResponse.json({ ok: false, error: "bad key" }, { status: 400 });
  const clean = key === "book" ? cleanBook(body.value) : null;
  if (!clean) return NextResponse.json({ ok: false, error: "bad value" }, { status: 400 });
  try {
    await redis(["SET", `cowrie:${uid}:${key}`, JSON.stringify(clean)]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "storage" }, { status: 502 });
  }
}
