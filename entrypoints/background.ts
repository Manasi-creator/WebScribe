import { initDatabase } from "../database/db";

export default defineBackground(async () => {
  console.log("🚀 WebScribe Background Started");

  await initDatabase();

  console.log("📦 Database Ready");
});