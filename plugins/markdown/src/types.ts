/**
 * Resolved values for the plugin's editor-panel config. Each field holds the
 * value Sigma resolves for the matching entry in `editorPanelConfig` —
 * `source` resolves to an element id, the rest to column ids within it.
 * Optional: the config arrives partial while the author is still wiring it
 * up, and the four corner columns are optional by design.
 */
export interface MarkdownConfig {
  source?: string
  bodyColumn?: string
  topLeftColumn?: string
  topRightColumn?: string
  bottomLeftColumn?: string
  bottomRightColumn?: string
}
