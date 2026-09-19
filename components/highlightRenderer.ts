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

function normalizeHighlightColor(color?: string | null): string {
  if (typeof color !== "string") {
    return DEFAULT_HIGHLIGHT_COLOR;
  }

  const normalized = color.trim().toUpperCase();
  return VALID_HIGHLIGHT_COLORS.has(normalized)
    ? normalized
    : DEFAULT_HIGHLIGHT_COLOR;
}

const HIGHLIGHT_STYLE: Partial<CSSStyleDeclaration> = {
  borderRadius: "3px",
  cursor: "pointer",
  padding: "1px 0",
  transition: "background-color 0.2s ease",
};

function isValidRange(range: Range): boolean {
  return (
    !!range &&
    !range.collapsed &&
    range.toString().trim().length > 0
  );
}

function createHighlightWrapper(
  id: string,
  color?: string | null
): HTMLSpanElement {
  const wrapper = document.createElement("span");

  wrapper.className = HIGHLIGHT_CLASS;
  wrapper.dataset.highlightId = id;

  Object.assign(wrapper.style, HIGHLIGHT_STYLE);
  wrapper.style.backgroundColor = normalizeHighlightColor(color);

  return wrapper;
}

function getTextNodesInRange(
  range: Range
): Text[] {
  const root = range.commonAncestorContainer;

  const container =
    root.nodeType === Node.TEXT_NODE
      ? root.parentNode
      : root;

  if (!container) {
    return [];
  }

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT
  );

  const nodes: Text[] = [];

  let node: Node | null;

  while ((node = walker.nextNode())) {
    const textNode = node as Text;

    if (!textNode.nodeValue?.trim()) {
      continue;
    }

    try {
      if (range.intersectsNode(textNode)) {
        nodes.push(textNode);
      }
    } catch {
      // Ignore nodes that cannot be tested
    }
  }

  return nodes;
}

function getSelectionOffsets(
  range: Range,
  textNode: Text
) {
  let start = 0;
  let end = textNode.length;

  if (range.startContainer === textNode) {
    start = range.startOffset;
  }

  if (range.endContainer === textNode) {
    end = range.endOffset;
  }

  return {
    start,
    end,
  };
}

export function renderHighlight(
  range: Range,
  id: string,
  onClick?: (
    highlightId: string,
    rect: DOMRect
  ) => void,
  color?: string | null
) {
  console.log("🎨 Rendering highlight:", id);

  if (!isValidRange(range)) {
    console.warn(
      "⚠️ Invalid range. Cannot highlight."
    );

    return;
  }

  const textNodes = getTextNodesInRange(range);

  if (textNodes.length === 0) {
    console.warn(
      "⚠️ No text nodes found in selection."
    );

    return;
  }

  for (const textNode of textNodes) {
    const parent =
      textNode.parentElement;

    if (!parent) {
      continue;
    }

    // Don't highlight something that is already highlighted
    if (
      parent.closest(
        `.${HIGHLIGHT_CLASS}`
      )
    ) {
      continue;
    }

    const {
      start,
      end,
    } = getSelectionOffsets(
      range,
      textNode
    );

    if (start >= end) {
      continue;
    }

    const text = textNode.nodeValue || "";

    const before = text.slice(
      0,
      start
    );

    const selected = text.slice(
      start,
      end
    );

    const after = text.slice(end);

    const fragment =
      document.createDocumentFragment();

    if (before) {
      fragment.appendChild(
        document.createTextNode(before)
      );
    }

    if (selected) {
      const wrapper =
        createHighlightWrapper(id, color);

      wrapper.textContent = selected;

      wrapper.addEventListener(
        "click",
        (event) => {
          event.stopPropagation();

          const rect =
            wrapper.getBoundingClientRect();

          console.log(
            "🖱️ Highlight clicked:",
            id
          );

          if (onClick) {
            console.log(
              "📞 Calling note handler..."
            );

            onClick(id, rect);
          }
        }
      );

      fragment.appendChild(wrapper);
    }

    if (after) {
      fragment.appendChild(
        document.createTextNode(after)
      );
    }

    textNode.parentNode?.replaceChild(
      fragment,
      textNode
    );
  }

  console.log(
    "✅ Highlight rendered:",
    id
  );
}