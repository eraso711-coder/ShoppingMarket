import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthTokenPayload {
  userId: string;
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!token) {
    response.status(401).json({ error: "Authentication is required." });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    response.status(500).json({ error: "Authentication is not configured." });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as AuthTokenPayload;
    response.locals.userId = payload.userId;
    next();
  } catch {
    response.status(401).json({ error: "Your session is invalid or has expired. Please sign in again." });
  }
}
