import { browser } from "wxt/browser";
import {
  showHighlightToolbar,
  removeHighlightToolbar,
} from "../components/highlightToolbar";
import { renderHighlight } from "../components/highlightRenderer";
import { getCurrentSelection } from "../lib/highlight/selection";
import {
  findAnchorRange,
  generateAnchor,
} from "../lib/highlight/anchor";
import { showNotePopup } from "../components/notePopup";
import type { Highlight } from "../types/highlight";

const DEFAULT_HIGHLIGHT_COLOR = "#FFF59D";
const VALID_HIGHLIGHT_COLORS = new Set([
  "#FFF59D",
  "#BBDEFB",
  "#C8E6C9",
  "#F8BBD0",
  "#D1C4E9",
  "#FFE0B2",
]);
const WEBSCRIBE_HIGHLIGHT_PARAM = "webscribeHighlight";
const RESTORE_RETRY_DELAYS = [500, 1500, 3000];

function normalizeHighlightColor(color?: string | null) {
  if (typeof color !== "string") {
    return DEFAULT_HIGHLIGHT_COLOR;
  }

  const normalized = color.trim().toUpperCase();
  return VALID_HIGHLIGHT_COLORS.has(normalized)
    ? normalized
    : DEFAULT_HIGHLIGHT_COLOR;
}

export default defineContentScript({
  matches: ["<all_urls>"],

  main() {
    const unresolvedHighlights = new Set<string>();
    const restoreRetryTimers = new Map<string, number>();
    let restoreDebounceTimer: number | null = null;

    const finalizeUnresolvedHighlight = async (highlight: Highlight) => {
      if (highlight.orphaned) {
        return;
      }

      unresolvedHighlights.delete(highlight.id);

      const updateResponse = await browser.runtime.sendMessage({
        type: "UPDATE_HIGHLIGHT",
        highlight: {
          ...highlight,
          orphaned: true,
          updatedAt: Date.now(),
        },
      });

      if (!updateResponse?.success) {
        console.error(
          "❌ Failed to mark highlight orphaned:",
          updateResponse?.error
        );
      }
    };

    const scheduleHighlightRetry = (
      highlight: Highlight,
      attemptIndex: number
    ) => {
      const delay = RESTORE_RETRY_DELAYS[attemptIndex];

      if (delay === undefined) {
        void finalizeUnresolvedHighlight(highlight);
        return;
      }

      const timerId = window.setTimeout(async () => {
        const restored = await restoreSingleHighlight(highlight, false);

        if (restored) {
          unresolvedHighlights.delete(highlight.id);
          restoreRetryTimers.delete(highlight.id);
          return;
        }

        scheduleHighlightRetry(highlight, attemptIndex + 1);
      }, delay);

      restoreRetryTimers.set(highlight.id, timerId);
    };

    const handleHighlightClick = async (
      highlightId: string,
      rect: DOMRect
    ) => {
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

        for (const highlight of highlights) {
          const existingHighlight = document.querySelector(
            `[data-highlight-id="${CSS.escape(highlight.id)}"]`
          );

          if (existingHighlight) {
            unresolvedHighlights.delete(highlight.id);
            continue;
          }

          const restored = await restoreSingleHighlight(highlight, false);

          if (restored) {
            unresolvedHighlights.delete(highlight.id);
            continue;
          }

          if (!unresolvedHighlights.has(highlight.id)) {
            unresolvedHighlights.add(highlight.id);
            scheduleHighlightRetry(highlight, 0);
          }
        }
      } catch (error) {
        console.error(
          "❌ Failed to restore highlights:",
          error
        );
      }
    }

    async function restoreRequestedHighlight() {
      const requestedHighlightId = new URLSearchParams(window.location.search).get(
        WEBSCRIBE_HIGHLIGHT_PARAM
      );

      if (!requestedHighlightId) {
        return;
      }

      try {
        const response = await browser.runtime.sendMessage({
          type: "GET_HIGHLIGHT_BY_ID",
          id: requestedHighlightId,
        });

        if (!response?.success) {
          console.error(
            "❌ Failed to retrieve requested highlight:",
            response?.error
          );
          return;
        }

        const highlight = response.highlight;

        if (!highlight) {
          console.warn(
            "⚠️ Requested highlight not found:",
            requestedHighlightId
          );
          return;
        }

        if (highlight.orphaned) {
          console.warn(
            "⚠️ Requested highlight is orphaned and cannot be restored:",
            requestedHighlightId
          );
          return;
        }

        const restored = await restoreSingleHighlight(highlight, false);

        if (!restored) {
          if (!unresolvedHighlights.has(highlight.id)) {
            unresolvedHighlights.add(highlight.id);
            scheduleHighlightRetry(highlight, 0);
          }

          return;
        }

        const targetElement = document.querySelector(
          `[data-highlight-id="${CSS.escape(requestedHighlightId)}"]`
        ) as HTMLElement | null;

        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      } catch (error) {
        console.error(
          "❌ Failed to restore requested highlight:",
          error
        );
      }
    }

    async function restoreSingleHighlight(
      highlight: Highlight,
      shouldMarkOrphaned = true
    ) {
      const targetText =
        highlight?.highlightedText;

      if (!targetText) {
        return false;
      }

      const existingHighlight =
        document.querySelector(
          `[data-highlight-id="${CSS.escape(highlight.id)}"]`
        );

      if (existingHighlight) {
        return true;
      }

      const anchor =
        highlight.anchor ?? {
          exact: targetText,
          prefix: "",
          suffix: "",
        };

      const range = findAnchorRange({
        exact: anchor.exact || targetText,
        prefix: anchor.prefix || "",
        suffix: anchor.suffix || "",
      });

      if (!range) {
        console.warn(
          "⚠️ Could not restore highlight yet:",
          highlight.id
        );

        if (shouldMarkOrphaned && !highlight.orphaned) {
          const updateResponse =
            await browser.runtime.sendMessage({
              type: "UPDATE_HIGHLIGHT",
              highlight: {
                ...highlight,
                orphaned: true,
                updatedAt: Date.now(),
              },
            });

          if (!updateResponse?.success) {
            console.error(
              "❌ Failed to mark highlight orphaned:",
              updateResponse?.error
            );
          }
        }

        return false;
      }

      renderHighlight(
        range,
        highlight.id,
        handleHighlightClick,
        normalizeHighlightColor(highlight.color)
      );

      if (highlight.orphaned) {
        await browser.runtime.sendMessage({
          type: "UPDATE_HIGHLIGHT",
          highlight: {
            ...highlight,
            color: normalizeHighlightColor(highlight.color),
            orphaned: false,
            updatedAt: Date.now(),
          },
        });
      }

      return true;
    }

    async function restoreUnresolvedHighlights() {
      if (unresolvedHighlights.size === 0) {
        return;
      }

      const response = await browser.runtime.sendMessage({
        type: "GET_HIGHLIGHTS_BY_URL",
        url: window.location.href,
      });

      if (!response?.success) {
        return;
      }

      const highlights = response.highlights ?? [];
      const pending = highlights.filter((highlight) =>
        unresolvedHighlights.has(highlight.id)
      );

      for (const highlight of pending) {
        const restored = await restoreSingleHighlight(highlight, false);

        if (restored) {
          unresolvedHighlights.delete(highlight.id);
          const timerId = restoreRetryTimers.get(highlight.id);

          if (timerId) {
            window.clearTimeout(timerId);
            restoreRetryTimers.delete(highlight.id);
          }
        }
      }
    }

    function scheduleDynamicObservation() {
      if (!document.body) {
        return;
      }

      const observer = new MutationObserver(() => {
        if (restoreDebounceTimer) {
          window.clearTimeout(restoreDebounceTimer);
        }

        restoreDebounceTimer = window.setTimeout(() => {
          void restoreUnresolvedHighlights();
        }, 250);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    function installUrlChangeHooks() {
      const handleUrlChange = () => {
        void restoreSavedHighlights();
        void restoreRequestedHighlight();
      };

      window.addEventListener("popstate", handleUrlChange);

      const originalPushState = history.pushState.bind(history);
      history.pushState = (...args) => {
        const result = originalPushState(...args);
        window.dispatchEvent(new Event("webscribe:urlchange"));
        return result;
      };

      const originalReplaceState = history.replaceState.bind(history);
      history.replaceState = (...args) => {
        const result = originalReplaceState(...args);
        window.dispatchEvent(new Event("webscribe:urlchange"));
        return result;
      };

      window.addEventListener("webscribe:urlchange", handleUrlChange);
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
            const id =
              crypto.randomUUID();

            try {
              renderHighlight(
                range,
                id,
                handleHighlightClick
              );

              const anchor =
                generateAnchor(text, range);

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
                        DEFAULT_HIGHLIGHT_COLOR,

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
      restoreRequestedHighlight();
    }, 500);

    scheduleDynamicObservation();
    installUrlChangeHooks();
  },
});