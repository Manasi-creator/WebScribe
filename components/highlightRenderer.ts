export function renderHighlight(range: Range, id: string) {
  console.log("Rendering highlight");
  
  const span = document.createElement("span");

  span.className = "webscribe-highlight";

  span.dataset.highlightId = id;

  Object.assign(span.style, {
    backgroundColor: "#FFF59D",
    cursor: "pointer",
    borderRadius: "2px",
    padding: "1px 0",
  });

  try {
    range.surroundContents(span);
  } catch (error) {
    console.warn("Unable to highlight selection:", error);
  }
}