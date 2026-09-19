import { browser } from "wxt/browser";
import {
  showHighlightToolbar,
  removeHighlightToolbar,
} from "../components/highlightToolbar";
import { renderHighlight } from "../components/highlightRenderer";
import { getCurrentSelection } from "../lib/highlight/selection";
import { generateAnchor } from "../lib/highlight/anchor";
import { showNotePopup } from "../components/notePopup";

export default defineContentScript({
  matches: ["<all_urls>"],

  main() {
    console.log("📚 WebScribe Content Script Loaded");

    const handleHighlightClick = async (
      highlightId: string,
      rect: DOMRect
    ) => {
      console.log(
        "📝 Opening note popup for:",
        highlightId
      );

      try {
        const response =
          await browser.runtime.sendMessage({
            type: "GET_HIGHLIGHT_BY_ID",
            id: highlightId,
          });

        if (!response?.success) {
          console.error(
            "❌ Failed to get highlight:",
            response?.error
          );
          return;
        }

        const highlight =
          response.highlight;

        if (!highlight) {
          console.warn(
            "⚠️ Highlight not found:",
            highlightId
          );
          return;
        }

        showNotePopup(
          rect.left,
          rect.bottom + 8,
          highlight.note,

          async (note) => {
            try {
              const updatedHighlight = {
                ...highlight,

                note: note || null,

                updatedAt: Date.now(),
              };

              const updateResponse =
                await browser.runtime.sendMessage({
                  type: "UPDATE_HIGHLIGHT",
                  highlight: updatedHighlight,
                });

              if (!updateResponse?.success) {
                throw new Error(
                  updateResponse?.error ||
                    "Failed to update highlight"
                );
              }

              console.log(
                "📝 Note saved"
              );
            } catch (error) {
              console.error(
                "❌ Failed to save note:",
                error
              );
            }
          }
        );
      } catch (error) {
        console.error(
          "❌ Failed to open note popup:",
          error
        );
      }
    };

    async function restoreSavedHighlights() {
      try {
        const response =
          await browser.runtime.sendMessage({
            type: "GET_HIGHLIGHTS_BY_URL",
            url: window.location.href,
          });

        if (!response?.success) {
          console.error(
            "❌ Failed to retrieve highlights:",
            response?.error
          );

          return;
        }

        const highlights =
          response.highlights ?? [];

        console.log(
          `🔄 Restoring ${highlights.length} highlight(s)`
        );

        for (const highlight of highlights) {
          restoreSingleHighlight(highlight);
        }
      } catch (error) {
        console.error(
          "❌ Failed to restore highlights:",
          error
        );
      }
    }

    function restoreSingleHighlight(
      highlight: any
    ) {
      const targetText =
        highlight.highlightedText;

      if (!targetText) {
        return;
      }

      const walker =
        document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT
        );

      let node: Text | null;

      while (
        (node =
          walker.nextNode() as Text | null)
      ) {
        const text =
          node.textContent || "";

        const index =
          text.indexOf(targetText);

        if (index === -1) {
          continue;
        }

        const range =
          document.createRange();

        range.setStart(
          node,
          index
        );

        range.setEnd(
          node,
          index + targetText.length
        );

        renderHighlight(
          range,
          highlight.id,
          handleHighlightClick
        );

        console.log(
          "✅ Restored highlight:",
          targetText
        );

        return;
      }

      console.warn(
        "⚠️ Could not find highlight text:",
        targetText
      );
    }

    document.addEventListener(
      "mouseup",
      () => {
        const currentSelection =
          getCurrentSelection();

        if (!currentSelection) {
          removeHighlightToolbar();
          return;
        }

        const {
          text,
          range,
          rect,
        } = currentSelection;

        showHighlightToolbar(
          rect.left +
            window.scrollX,

          rect.top +
            window.scrollY -
            45,

          async () => {
            console.log(
              "📒 Highlight button clicked"
            );

            const id =
              crypto.randomUUID();

            try {
              renderHighlight(
                range,
                id,
                handleHighlightClick
              );

              const anchor =
                generateAnchor(text);

              console.log(
                "⚓ Generated anchor:",
                anchor
              );

              const response =
                await browser.runtime.sendMessage(
                  {
                    type:
                      "SAVE_HIGHLIGHT",

                    highlight: {
                      id,

                      url:
                        window.location.href,

                      domain:
                        window.location
                          .hostname,

                      pageTitle:
                        document.title,

                      highlightedText:
                        text,

                      anchor: {
                        exact:
                          text,

                        prefix:
                          anchor.prefix,

                        suffix:
                          anchor.suffix,
                      },

                      color:
                        "important",

                      note:
                        null,

                      createdAt:
                        Date.now(),

                      updatedAt:
                        Date.now(),

                      lastVisited:
                        Date.now(),

                      orphaned:
                        false,
                    },
                  }
                );

              if (
                !response?.success
              ) {
                throw new Error(
                  response?.error ||
                    "Failed to save highlight"
                );
              }

              console.log(
                "✅ Highlight Saved"
              );

              removeHighlightToolbar();

              window
                .getSelection()
                ?.removeAllRanges();
            } catch (error) {
              console.error(
                "❌ Highlight Failed:",
                error
              );
            }
          }
        );
      }
    );

    document.addEventListener(
      "mousedown",
      (event) => {
        const target =
          event.target as HTMLElement;

        if (
          target.closest(
            "#webscribe-toolbar"
          )
        ) {
          return;
        }

        if (
          window
            .getSelection()
            ?.toString()
            .trim()
        ) {
          return;
        }

        removeHighlightToolbar();
      }
    );

    setTimeout(() => {
      restoreSavedHighlights();
    }, 500);
  },
});