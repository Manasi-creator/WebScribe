import { showHighlightToolbar, removeHighlightToolbar } from "../components/highlightToolbar";
import { renderHighlight } from "../components/highlightRenderer";
import { saveHighlight } from "../database/highlights";

export default defineContentScript({
  matches: ["<all_urls>"],

  main() {
    console.log("📚 WebScribe Content Script Loaded");

    document.addEventListener("mouseup", () => {
      const selection = window.getSelection();

      if (!selection) return;

      const text = selection.toString().trim();

      if (!text) {
        removeHighlightToolbar();
        return;
      }

      const range = selection.getRangeAt(0).cloneRange();
      const rect = range.getBoundingClientRect();

      showHighlightToolbar(
        rect.left + window.scrollX,
        rect.top + window.scrollY - 45,
        async () => {
          console.log("📒 Highlight button clicked");

          const id = crypto.randomUUID();

          try {
            // Render highlight on the page
            renderHighlight(range, id);

            // Save highlight to IndexedDB
            await saveHighlight({
              id,
              url: window.location.href,
              domain: window.location.hostname,
              pageTitle: document.title,
              highlightedText: text,

              anchor: {
                prefix: "",
                suffix: "",
                startOffset: 0,
              },

              color: "important",
              note: null,

              createdAt: Date.now(),
              updatedAt: Date.now(),
              lastVisited: Date.now(),

              orphaned: false,
            });

            console.log("✅ Highlight Saved");

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