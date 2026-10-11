// User-supplied links must be plain http(s). The database enforces the same
// rule (evidence_link_http_only etc., P0-3); this keeps the UI honest and is
// defence in depth when rendering a link.
const HTTP_URL = /^https?:\/\/[^\s]+$/i;
const MAX_URL_LENGTH = 2048;

export const LINK_ERROR = "Links must start with http:// or https:// and contain no spaces.";

export function isHttpUrl(value: string): boolean {
  return value.length <= MAX_URL_LENGTH && HTTP_URL.test(value);
}

// Returns the value only if it is safe to put in an <a href>, else undefined.
export function safeHref(value: string | null | undefined): string | undefined {
  return value && isHttpUrl(value) ? value : undefined;
}
