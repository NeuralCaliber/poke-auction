export function corsHeaders(request: Request): Headers {
  const origin = request.headers.get("Origin") ?? "*";
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  return headers;
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
): Response {
  const headers = corsHeaders(request);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

export function optionsResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
