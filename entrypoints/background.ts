import { browser } from "wxt/browser";

import { initDatabase } from "../lib/database/db";

import {
  saveHighlight,
  getAllHighlights,
  getHighlightsByUrl,
  getHighlightById,
  updateHighlight,
  deleteHighlight,
  deleteAllHighlights,
} from "../lib/database/highlights";

export default defineBackground(async () => {
  console.log("🚀 WebScribe Background Started");

  // ==========================================
  // INITIALIZE DATABASE
  // ==========================================

  try {
    await initDatabase();

    console.log("📦 Database Ready");
  } catch (error) {
    console.error(
      "❌ Database initialization failed:",
      error
    );
  }

  // ==========================================
  // MESSAGE HANDLER
  // ==========================================

  browser.runtime.onMessage.addListener(
    async (message) => {
      try {
        switch (message?.type) {

          // ========================================
          // SAVE HIGHLIGHT
          // ========================================

          case "SAVE_HIGHLIGHT": {
            await saveHighlight(
              message.highlight
            );

            console.log(
              "✅ Highlight saved in background"
            );

            return {
              success: true,
            };
          }

          // ========================================
          // GET ALL HIGHLIGHTS
          // ========================================

          case "GET_ALL_HIGHLIGHTS": {
            const highlights =
              await getAllHighlights();

            console.log(
              `📚 Retrieved ${highlights.length} highlights`
            );

            return {
              success: true,
              highlights,
            };
          }

          // ========================================
          // GET HIGHLIGHTS FOR CURRENT URL
          // ========================================

          case "GET_HIGHLIGHTS_BY_URL": {
            const highlights =
              await getHighlightsByUrl(
                message.url
              );

            console.log(
              `📚 Retrieved ${highlights.length} highlights for ${message.url}`
            );

            return {
              success: true,
              highlights,
            };
          }

          // ========================================
          // GET SINGLE HIGHLIGHT
          // ========================================

          case "GET_HIGHLIGHT_BY_ID": {
            const highlight =
              await getHighlightById(
                message.id
              );

            console.log(
              "🔎 Retrieved highlight:",
              message.id
            );

            return {
              success: true,
              highlight,
            };
          }

          // ========================================
          // UPDATE HIGHLIGHT
          // ========================================

          case "UPDATE_HIGHLIGHT": {
            await updateHighlight(
              message.highlight
            );

            console.log(
              "📝 Highlight updated:",
              message.highlight.id
            );

            return {
              success: true,
            };
          }

          // ========================================
          // DELETE HIGHLIGHT
          // ========================================

          case "DELETE_HIGHLIGHT": {
            await deleteHighlight(message.id);

            console.log(
              "🗑️ Highlight deleted:",
              message.id
            );

            return {
              success: true,
            };
          }

          // ========================================
          // DELETE ALL HIGHLIGHTS
          // ========================================

          case "DELETE_ALL_HIGHLIGHTS": {
            await deleteAllHighlights();

            console.log("🧹 All highlights deleted");

            return {
              success: true,
            };
          }

          // ========================================
          // UNKNOWN MESSAGE
          // ========================================

          default: {
            console.warn(
              "⚠️ Unknown message type:",
              message?.type
            );

            return {
              success: false,
              error: "Unknown message type",
            };
          }
        }

      } catch (error) {

        console.error(
          "❌ Background database error:",
          error
        );

        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        };
      }
    }
  );
});