'use client'

/**
 * Thin fetch wrapper for the dashboard.
 *
 * Every API route answers with either the payload or `{ error }`, so error
 * handling belongs in one place rather than repeated in every component.
 */

export class ApiRequestError extends Error {}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiRequestError('Network error — check the connection and try again.')
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiRequestError(
      (payload as { error?: string } | null)?.error ?? `Request failed (${response.status})`
    )
  }

  return payload as T
}

export function apiGet<T>(url: string): Promise<T> {
  return request<T>(url, { method: 'GET', cache: 'no-store' })
}

export function apiSend<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<T> {
  return request<T>(url, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

/** Builds a query string, dropping empty values. */
export function query(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}
