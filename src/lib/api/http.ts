/** JSON response helpers for the REST API. */

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function apiError(
  status: number,
  code: string,
  message: string
): Response {
  return json({ error: { code, message } }, status);
}

export const unauthorized = (m = "Missing or invalid token.") =>
  apiError(401, "unauthorized", m);
export const forbidden = (m = "You do not have permission.") =>
  apiError(403, "forbidden", m);
export const notFound = (m = "Not found.") => apiError(404, "not_found", m);
export const badRequest = (m = "Bad request.") =>
  apiError(400, "bad_request", m);
