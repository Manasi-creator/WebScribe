const HIGHLIGHT_CLASS = "webscribe-highlight";

export function renderHighlight(range: Range, id: string) {
  if (range.collapsed) return;

  // Extract the selected DOM
  const fragment = range.extractContents();

  // Create highlight wrapper
  const wrapper = document.createElement("span");

  wrapper.className = HIGHLIGHT_CLASS;

  wrapper.dataset.highlightId = id;

  wrapper.style.background = "#FFF59D";
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