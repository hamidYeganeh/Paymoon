import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./generated",
  dialect: "postgresql",
  schemaFilter: ["commerce"],
  dbCredentials: { url: process.env.COMMERCE_DATABASE_URL! },
});
