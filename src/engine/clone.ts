/**
 * Deep-clone an engine value. GameState is plain JSON data, and JSON
 * round-tripping (unlike structuredClone) also works on Svelte's $state
 * proxies — structuredClone throws DataCloneError on proxied objects.
 */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
