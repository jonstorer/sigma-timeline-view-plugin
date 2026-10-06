/**
 * Resolved values for the plugin's editor-panel config. Each field holds the
 * value Sigma resolves for the matching entry in `editorPanelConfig` — both
 * resolve to ids (the element id, and the column id within it). Optional:
 * the config arrives partial while the author is still wiring it up.
 */
export interface MarkdownConfig {
  source?: string
  markdownColumn?: string
}
