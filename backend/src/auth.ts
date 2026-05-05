import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export type JwtPayload = { sub: string; email: string };

/** Demo auth: JWT in Authorization header. localStorage on client is iframe-friendly vs cookies. */
export function signToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  return decoded;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = verifyToken(token);
    (req as AuthedRequest).userId = payload.sub;
    (req as AuthedRequest).userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export type AuthedRequest = Request & { userId: string; userEmail: string };
