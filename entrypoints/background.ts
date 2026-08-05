import { initDatabase } from "../lib/database/db";

export default defineBackground(async () => {
  console.log("🚀 WebScribe Background Started");

  await initDatabase();

  console.log("📦 Database Ready");
});