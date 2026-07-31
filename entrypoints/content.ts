export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    console.log("WebScribe Content Script Loaded");
  },
});