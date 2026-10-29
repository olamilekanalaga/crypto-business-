export async function api<T>(action: string, data: unknown = {}): Promise<T> {
  const response = await fetch("/api/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok || body.error)
    throw new Error(body.error || "Request failed");
  return body.data;
}
export function date(value?: string | null) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not yet refreshed";
}
export function number(value: number | null | undefined) {
  return value == null ? "—" : value.toLocaleString();
}
