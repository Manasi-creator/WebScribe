import { showHighlightToolbar, removeHighlightToolbar } from "../components/highlightToolbar";
import { renderHighlight } from "../components/highlightRenderer";
import { saveHighlight } from "../lib/database/highlights";
import { getCurrentSelection } from "../lib/highlight/selection";
import { generateAnchor } from "../lib/highlight/anchor";
import { restoreHighlights } from "../lib/highlight/restore";
import { getHighlightsByUrl } from "../lib/database/highlights";
import { getHighlightById, updateHighlight } from "../lib/database/highlights";
import { showNotePopup } from "../components/notePopup";
import { handleHighlightClick } from "../lib/highlight/interaction";

export default defineContentScript({
  matches: ["<all_urls>"],

  main() {
    console.log("📚 WebScribe Content Script Loaded");

    const handleHighlightClick = async (
      highlightId: string,
      rect: DOMRect
    ) => {
      const highlight = await getHighlightById(highlightId);

      if (!highlight) {
        console.warn("Highlight not found:", highlightId);
        return;
      }

      showNotePopup(
        rect.left + window.scrollX,
        rect.bottom + window.scrollY + 8,
        highlight.note,
        async (note) => {
          const updatedHighlight = {
            ...highlight,
            note: note || null,
            updatedAt: Date.now(),
          };

          await updateHighlight(updatedHighlight);

          console.log("Note saved");
        }
      );
    };

    (async () => {

      const highlights = await getHighlightsByUrl(
        window.location.href
      );

      restoreHighlights(highlights);

    })();

    document.addEventListener("mouseup", () => {
      const currentSelection = getCurrentSelection();

      if (!currentSelection) {
        removeHighlightToolbar();
        return;
      }

      const { text, range, rect } = currentSelection;

      showHighlightToolbar(
        rect.left + window.scrollX,
        rect.top + window.scrollY - 45,
        async () => {

          const id = crypto.randomUUID();

          try {
            renderHighlight(
              range,
              id,
              handleHighlightClick
            );

            const anchor = generateAnchor(text);

            await saveHighlight({
              id,
              url: window.location.href,
              domain: window.location.hostname,
              pageTitle: document.title,
              highlightedText: text,

              anchor: generateAnchor(text),

              color: "important",
              note: null,

              createdAt: Date.now(),
              updatedAt: Date.now(),
              lastVisited: Date.now(),

              orphaned: false,
            });

            removeHighlightToolbar();
            window.getSelection()?.removeAllRanges();
          } catch (err) {
            console.error("❌ Highlight Failed:", err);
          }
        }
      );
    });

    document.addEventListener("mousedown", (event) => {
      const target = event.target as HTMLElement;

      if (target.closest("#webscribe-toolbar")) {
        return;
      }

      if (window.getSelection()?.toString().trim()) {
        return;
      }

      removeHighlightToolbar();
    });
  },
});