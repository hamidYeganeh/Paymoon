import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  join(homedir(), "Library/Android/sdk");
if (!existsSync(sdk))
  throw new Error("Set ANDROID_HOME to the Android SDK directory");
const run = spawnSync(
  process.platform === "win32" ? "gradlew.bat" : "./gradlew",
  ["assembleDebug", "--no-daemon"],
  {
    cwd: "android",
    env: { ...process.env, ANDROID_HOME: sdk },
    stdio: "inherit",
  },
);
if (run.error) throw run.error;
process.exitCode = run.status ?? 1;
