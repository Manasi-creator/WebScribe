export interface CurrentSelection {
  text: string;
  range: Range;
  rect: DOMRect;
}

export function getCurrentSelection(): CurrentSelection | null {
  const selection = window.getSelection();

  if (!selection) {
    return null;
  }

  if (selection.rangeCount === 0) {
    return null;
  }

  const text = selection.toString().trim();

  if (!text) {
    return null;
  }

  const range = selection.getRangeAt(0).cloneRange();

  if (range.collapsed) {
    return null;
  }

  const rect = range.getBoundingClientRect();

  return {
    text,
    range,
    rect,
  };
}