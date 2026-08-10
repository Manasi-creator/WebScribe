const HIGHLIGHT_CLASS = "webscribe-highlight";

export function renderHighlight(
  range: Range,
  id: string,
  onClick?: (id: string, rect: DOMRect) => void
) {
  console.log("🎨 Rendering highlight:", id);

  const span = document.createElement("span");

  span.className = HIGHLIGHT_CLASS;
  span.dataset.highlightId = id;

  Object.assign(span.style, {
    backgroundColor: "#FFF59D",
    cursor: "pointer",
    borderRadius: "2px",
    padding: "1px 0",
  });

  span.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    console.log("🖱️ Highlight clicked:", id);

    const rect = span.getBoundingClientRect();

    if (onClick) {
      console.log("📝 Calling note handler...");
      onClick(id, rect);
    } else {
      console.warn("⚠️ No click handler provided");
    }
  });

  try {
    range.surroundContents(span);
    console.log("✅ Highlight rendered successfully");
  } catch (error) {
    console.warn("❌ Unable to highlight selection:", error);
  }
}