import {getHighlightById, updateHighlight} from "../database/highlights";

import { showNotePopup } from "../../components/notePopup";

export async function handleHighlightClick(
  highlightId: string,
  rect: DOMRect
) {
  console.log("📝 Opening note popup for:", highlightId);

  const highlight = await getHighlightById(highlightId);

  if (!highlight) {
    console.warn("⚠️ Highlight not found:", highlightId);
    return;
  }

  showNotePopup(
    rect.left,
    rect.bottom + 8,
    highlight.note,
    async (note) => {
      await updateHighlight({
        ...highlight,
        note: note || null,
        updatedAt: Date.now(),
      });

      console.log("📝 Note saved");
    }
  );
}