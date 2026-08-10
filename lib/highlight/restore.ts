import { renderHighlight } from "../../components/highlightRenderer";
import { Highlight } from "../../types/highlight";

export function restoreHighlights(highlights: Highlight[]) {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT
  );

  const textNodes: Text[] = [];

  let node;

  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  for (const highlight of highlights) {
    const target = highlight.anchor.exact;

    for (const textNode of textNodes) {
      const content = textNode.textContent ?? "";

      const index = content.indexOf(target);

      if (index === -1) continue;

      const range = document.createRange();

      range.setStart(textNode, index);
      range.setEnd(textNode, index + target.length);

      renderHighlight(range, highlight.id);

      break;
    }
  }
}