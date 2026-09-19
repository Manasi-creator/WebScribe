const HIGHLIGHT_CLASS = "webscribe-highlight";
const DEFAULT_HIGHLIGHT_COLOR = "#FFF59D";
const VALID_HIGHLIGHT_COLORS = new Set([
  "#FFF59D",
  "#BBDEFB",
  "#C8E6C9",
  "#F8BBD0",
  "#D1C4E9",
  "#FFE0B2",
]);

function normalizeHighlightColor(color?: string | null) {
  if (typeof color !== "string") {
    return DEFAULT_HIGHLIGHT_COLOR;
  }

  const normalized = color.trim().toUpperCase();
  return VALID_HIGHLIGHT_COLORS.has(normalized)
    ? normalized
    : DEFAULT_HIGHLIGHT_COLOR;
}

export function renderHighlight(range: Range, id: string, color?: string | null) {
  if (range.collapsed) return;

  // Extract the selected DOM
  const fragment = range.extractContents();

  // Create highlight wrapper
  const wrapper = document.createElement("span");

  wrapper.className = HIGHLIGHT_CLASS;

  wrapper.dataset.highlightId = id;

  wrapper.style.background = normalizeHighlightColor(color);
  wrapper.style.borderRadius = "3px";
  wrapper.style.cursor = "pointer";
  wrapper.style.transition = "background-color .2s ease";

  // Put the selected DOM inside wrapper
  wrapper.appendChild(fragment);

  // Insert back into page
  range.insertNode(wrapper);

  // Collapse selection
  range.collapse(false);
}