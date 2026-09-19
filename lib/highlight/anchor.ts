export interface TextAnchor {
  exact: string;
  prefix: string;
  suffix: string;
}

function normalizeForComparison(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function buildNormalizedTextMap(value: string) {
  const normalized: string[] = [];
  const rawIndexes: number[] = [];

  for (let index = 0; index < value.length; index++) {
    const char = value[index];

    if (/\s/.test(char)) {
      continue;
    }

    normalized.push(char.toLowerCase());
    rawIndexes.push(index);
  }

  return {
    normalized: normalized.join(""),
    rawIndexes,
  };
}

function getTextSegments(root: ParentNode = document.body) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.textContent?.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        const parent = node.parentElement;

        if (
          parent &&
          parent.closest("script, style, noscript")
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const segments: Array<{
    node: Text;
    start: number;
    end: number;
  }> = [];

  let offset = 0;
  let currentNode: Node | null;

  while ((currentNode = walker.nextNode())) {
    const textNode = currentNode as Text;
    const text = textNode.textContent ?? "";

    if (!text) {
      continue;
    }

    segments.push({
      node: textNode,
      start: offset,
      end: offset + text.length,
    });

    offset += text.length;
  }

  const text = segments
    .map((segment) => segment.node.textContent ?? "")
    .join("");

  return {
    text,
    segments,
  };
}

export function generateAnchor(
  selectedText: string,
  range?: Range | null
): TextAnchor {
  const targetText = selectedText || "";

  if (!targetText) {
    return {
      exact: "",
      prefix: "",
      suffix: "",
    };
  }

  if (!range) {
    return {
      exact: targetText,
      prefix: "",
      suffix: "",
    };
  }

  const CONTEXT = 30;
  const textValue = range.toString();

  if (!textValue) {
    return {
      exact: targetText,
      prefix: "",
      suffix: "",
    };
  }

  const startIndex = range.startOffset;
  const endIndex = range.endOffset;
  const startNode = range.startContainer;
  const endNode = range.endContainer;

  const startText =
    startNode.nodeType === Node.TEXT_NODE
      ? (startNode.textContent ?? "")
      : "";

  const endText =
    endNode.nodeType === Node.TEXT_NODE
      ? (endNode.textContent ?? "")
      : "";

  const prefixText = startText.slice(
    Math.max(0, startIndex - CONTEXT),
    startIndex
  );

  const suffixText = endText.slice(
    endIndex,
    endIndex + CONTEXT
  );

  return {
    exact: targetText,
    prefix: prefixText,
    suffix: suffixText,
  };
}

export function findAnchorRange(
  anchor: TextAnchor
): Range | null {
  const exact = (anchor?.exact ?? "").trim();

  if (!exact) {
    return null;
  }

  const { text, segments } = getTextSegments();

  if (!text) {
    return null;
  }

  const fullText = text;
  const { normalized: normalizedFullText, rawIndexes } =
    buildNormalizedTextMap(fullText);
  const { normalized: normalizedExact } =
    buildNormalizedTextMap(exact);
  const normalizedPrefix = normalizeForComparison(
    anchor.prefix ?? ""
  );
  const normalizedSuffix = normalizeForComparison(
    anchor.suffix ?? ""
  );

  if (!normalizedExact) {
    return null;
  }

  let startIndex = 0;

  while (startIndex < normalizedFullText.length) {
    const matchIndex =
      normalizedFullText.indexOf(
        normalizedExact,
        startIndex
      );

    if (matchIndex === -1) {
      break;
    }

    const matchEndIndex = matchIndex + normalizedExact.length;

    const pageBefore = normalizedFullText.slice(
      Math.max(0, matchIndex - normalizedPrefix.length),
      matchIndex
    );

    const pageAfter = normalizedFullText.slice(
      matchEndIndex,
      Math.min(
        normalizedFullText.length,
        matchEndIndex + normalizedSuffix.length
      )
    );

    const prefixMatches =
      !normalizedPrefix ||
      pageBefore.endsWith(normalizedPrefix);

    const suffixMatches =
      !normalizedSuffix ||
      pageAfter.startsWith(normalizedSuffix);

    if (prefixMatches && suffixMatches) {
      const rawStart = rawIndexes[matchIndex];
      const rawEnd = rawIndexes[matchEndIndex - 1] + 1;

      const startSegment = segments.find(
        (segment) =>
          rawStart >= segment.start && rawStart < segment.end
      );

      const endSegment = segments.find(
        (segment) =>
          rawEnd > segment.start && rawEnd <= segment.end
      );

      if (!startSegment || !endSegment) {
        return null;
      }

      const range = document.createRange();
      const startOffset = rawStart - startSegment.start;
      const endOffset = rawEnd - endSegment.start;

      range.setStart(
        startSegment.node,
        startOffset
      );
      range.setEnd(
        endSegment.node,
        endOffset
      );

      if (!range.collapsed && range.toString().trim()) {
        return range;
      }
    }

    startIndex = matchIndex + 1;
  }

  return null;
}