export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
// Uploaded files (resumes, logos) are served outside the /api/v1 prefix —
// see apps/api/src/main.ts's static /uploads mount.
export const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '');

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Client-side fetch helper. Attaches the in-memory access token (if any)
// and always sends the refresh cookie (credentials: 'include') so the
// caller can retry after a silent refresh on 401 — see auth-context.tsx.
export async function apiFetch<T = any>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = data?.message
      ? Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message
      : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

// Multipart upload helper (resume/logo). No Content-Type header — the
// browser sets the multipart boundary itself when given a FormData body.
export async function apiUpload<T = any>(path: string, file: File, token: string | null): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const message = data?.message ? (Array.isArray(data.message) ? data.message.join(', ') : data.message) : `Upload failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

// Downloads a non-JSON authenticated response (e.g. the .ics calendar file
// for an interview) as a file — apiFetch can't be reused here since it only
// ever parses application/json bodies.
export async function downloadFile(path: string, token: string | null, filename: string) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, 'Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Server-component fetch helper for public pages (no auth needed).
export async function publicFetch<T = any>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
