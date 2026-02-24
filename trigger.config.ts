import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Set via TRIGGER_PROJECT_ID env var or replace with your project ID from trigger.dev dashboard
  project: process.env.TRIGGER_PROJECT_ID ?? "proj_replace_me",
  dirs: ["./trigger"],
  build: {
    extensions: [],
  },
});
