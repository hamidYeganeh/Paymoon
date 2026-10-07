import { readConfig } from "@paymoon/config";
import { createApp } from "./app";
void createApp()
  .then((app) =>
    app.listen(readConfig().PORT ?? readConfig().COMMERCE_API_PORT, "0.0.0.0"),
  )
  .catch(() => {
    console.error("API startup failed; check configuration and dependencies");
    process.exitCode = 1;
  });
