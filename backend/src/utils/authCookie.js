const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

// Converte JWT_EXPIRES_IN (formato do jsonwebtoken: "8h", "30m", "7d", ou segundos puros)
// para ms, mantendo cookie e token expirando juntos
export function jwtExpiresInMs() {
  const raw = String(process.env.JWT_EXPIRES_IN || "8h");
  const match = raw.match(/^(\d+)\s*([smhd])?$/i);
  if (!match) return 8 * UNIT_MS.h;
  const unit = match[2] ? UNIT_MS[match[2].toLowerCase()] : UNIT_MS.s;
  return Number(match[1]) * unit;
}

export function setAuthCookie(res, token) {
  res.cookie("hd_token", token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "strict",
    maxAge: jwtExpiresInMs(),
  });
}
