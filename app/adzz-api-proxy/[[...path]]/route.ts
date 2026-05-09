import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SKIP_REQ_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "host",
  "content-length",
  /** Undici decompresses gzip but may leave Content-Encoding; asking upstream for gzip then strips on response. */
  "accept-encoding",
]);

/** Strip after fetch: Node fetch decompresses body but upstream headers can still say gzip. */
const SKIP_RES_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
]);

function upstreamBase(): string {
  return (
    process.env.ADZZ_API_UPSTREAM ?? "http://65.2.181.155/adzz-api"
  ).replace(/\/$/, "");
}

function targetUrl(segments: string[], search: string): string {
  const path = segments.length ? segments.join("/") : "";
  const base = path ? `${upstreamBase()}/${path}` : upstreamBase();
  return search ? `${base}${search}` : base;
}

async function proxy(req: NextRequest, segments: string[]) {
  const url = targetUrl(segments, req.nextUrl.search);

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!SKIP_REQ_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: `Upstream unreachable (${upstreamBase()}). ${msg}`,
      },
      { status: 502 }
    );
  }

  const out = new Headers();
  res.headers.forEach((value, key) => {
    if (!SKIP_RES_HEADERS.has(key.toLowerCase())) {
      out.set(key, value);
    }
  });

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function OPTIONS(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function HEAD(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}
