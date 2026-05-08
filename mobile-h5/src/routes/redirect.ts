export function safeRedirect(value: string | null) {
  return value?.startsWith("/") ? value : "/ship";
}
