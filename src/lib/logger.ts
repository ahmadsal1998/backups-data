type Level = "info" | "warn" | "error" | "debug";

function line(level: Level, msg: string, meta?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };
  const text = JSON.stringify(payload);
  if (level === "error") {
    console.error(text);
  } else {
    console.log(text);
  }
}

export const log = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    line("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    line("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) =>
    line("error", msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) =>
    line("debug", msg, meta),
};
