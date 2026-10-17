let csrf = "";
export function setCsrf(value) {
  csrf = value || "";
}
export async function request(
  path,
  { method = "GET", body, raw = false, signal } = {},
) {
  const headers = {};
  if (method !== "GET") headers["X-CSRF-Token"] = csrf;
  if (body !== undefined && !raw) headers["Content-Type"] = "application/json";
  const response = await fetch("/api" + path, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    signal,
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response.");
  }
  if (!response.ok) {
    if (
      response.status === 401 &&
      path !== "/auth/login" &&
      path !== "/auth/me"
    )
      window.dispatchEvent(new Event("orbit:unauthorized"));
    const error = new Error(result.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return result.data;
}
export const api = {
  get: (p, signal) => request(p, { signal }),
  post: (p, b) => request(p, { method: "POST", body: b ?? {} }),
  patch: (p, b) => request(p, { method: "PATCH", body: b }),
  put: (p, b) => request(p, { method: "PUT", body: b }),
  delete: (p) => request(p, { method: "DELETE" }),
  upload: (p, file) => request(p, { method: "POST", body: file, raw: true }),
};
