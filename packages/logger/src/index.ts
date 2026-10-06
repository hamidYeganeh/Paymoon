import pino from "pino";
export const createLogger = (name: string, level = "info") =>
  pino({
    name,
    level,
    redact: {
      paths: [
        "password",
        "token",
        "authorization",
        "cookie",
        "req.headers.authorization",
        "req.headers.cookie",
        "body",
        "payload",
      ],
      censor: "[REDACTED]",
    },
  });
