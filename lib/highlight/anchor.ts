export interface TextAnchor {
  exact: string;
  prefix: string;
  suffix: string;
}

export function generateAnchor(
  selectedText: string
): TextAnchor {

  const pageText = document.body.innerText;

  const index = pageText.indexOf(selectedText);

  if (index === -1) {
    return {
      exact: selectedText,
      prefix: "",
      suffix: "",
    };
  }

  const CONTEXT = 30;

  return {
    exact: selectedText,

    prefix: pageText.substring(
      Math.max(0, index - CONTEXT),
      index
    ),

    suffix: pageText.substring(
      index + selectedText.length,
      index + selectedText.length + CONTEXT
    ),
  };
}