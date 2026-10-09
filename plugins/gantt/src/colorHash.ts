/**
 * Deterministic "pick a consistent color for this name" hashing — the same
 * pattern Slack/Linear/GitHub use for avatar colors. The specific hue a given
 * name lands on is arbitrary (a hash-distribution artifact); the only
 * property that matters is that the same key always maps to the same pair.
 *
 * Fully algorithmic via HSL, not a small fixed palette: the hash maps
 * directly onto a hue (0-359), giving up to 360 distinct colors instead of
 * however many entries a hand-picked list happens to have — a palette of
 * ~8-10 collides constantly once there are more than a handful of distinct
 * names. Background and text share the hash-chosen hue (so they read as a
 * matching pair, e.g. a pastel yellow bg with a dark olive text) but differ
 * in fixed saturation/lightness: the background always stays pastel (high
 * lightness) and the text always stays dark and saturated, so contrast is
 * guaranteed regardless of which hue a given name happens to land on. This
 * mirrors the *look* of incident.io's on-call view, not their exact
 * palette — we don't have their hash seed or color list, so it's
 * consistent-per-person, not pixel-matched to theirs.
 */

export interface ColorPair {
  background: string
  text: string
}

const HUE_COUNT = 360
const BACKGROUND_SATURATION = 70
const BACKGROUND_LIGHTNESS = 90
const TEXT_SATURATION = 55
const TEXT_LIGHTNESS = 30

/** djb2 — simple, fast, and more than sufficient for picking a hue; no need
 * for cryptographic distribution here. */
function hashString(key: string): number {
  let hash = 5381
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i)
  }
  return hash >>> 0
}

/** Same key always returns the same pair; an empty key falls back to hue 0
 * rather than throwing or returning undefined. */
export function colorForKey(key: string): ColorPair {
  const hue = key ? hashString(key) % HUE_COUNT : 0
  return {
    background: `hsl(${hue}, ${BACKGROUND_SATURATION}%, ${BACKGROUND_LIGHTNESS}%)`,
    text: `hsl(${hue}, ${TEXT_SATURATION}%, ${TEXT_LIGHTNESS}%)`,
  }
}
