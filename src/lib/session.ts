import type { SessionOptions } from "iron-session";

export type SessionData = {
  isLoggedIn?: boolean;
};

function getSessionPassword(): string {
  const p = process.env.SESSION_SECRET;
  if (!p || p.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return p;
}

export function getSessionOptions(): SessionOptions {
  return {
    password: getSessionPassword(),
    cookieName: "backup_dashboard_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    },
  };
}
