import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

function createToken(userId: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  }
  return jwt.sign({ userId }, secret, { expiresIn: "7d" });
}

function publicUser(user: { id: string; email: string; firstName: string; lastName: string }) {
  return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
}

router.post("/register", async (request, response, next) => {
  try {
    const { email, password, firstName, lastName, familyName } = request.body ?? {};
    if (
      typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" || password.length < 8 ||
      typeof firstName !== "string" || !firstName.trim() ||
      typeof lastName !== "string" || !lastName.trim() ||
      typeof familyName !== "string" || !familyName.trim()
    ) {
      response.status(400).json({
        error: "Please provide a valid email, a password of at least 8 characters, your first and last name, and a family name."
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          firstName: firstName.trim(),
          lastName: lastName.trim()
        }
      });
      const family = await transaction.family.create({
        data: {
          name: familyName.trim(),
          memberships: { create: { userId: user.id, role: "OWNER" } }
        }
      });
      return { user, family };
    });

    response.status(201).json({
      token: createToken(result.user.id),
      user: publicUser(result.user),
      family: { id: result.family.id, name: result.family.name, role: "OWNER" }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      response.status(409).json({ error: "An account with this email address already exists." });
      return;
    }
    next(error);
  }
});

router.post("/login", async (request, response, next) => {
  try {
    const { email, password } = request.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      response.status(400).json({ error: "Please enter your email address and password." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: {
        memberships: {
          include: { family: true },
          orderBy: { joinedAt: "asc" },
          take: 1
        }
      }
    });

    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      response.status(401).json({ error: "The email address or password is incorrect." });
      return;
    }

    const membership = user.memberships[0];
    response.json({
      token: createToken(user.id),
      user: publicUser(user),
      family: membership ? {
        id: membership.family.id,
        name: membership.family.name,
        role: membership.role
      } : null
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (_request, response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: response.locals.userId as string },
      include: {
        memberships: {
          include: { family: true },
          orderBy: { joinedAt: "asc" },
          take: 1
        }
      }
    });

    if (!user || !user.isActive) {
      response.status(401).json({ error: "This account is no longer available." });
      return;
    }

    const membership = user.memberships[0];
    response.json({
      user: publicUser(user),
      family: membership ? {
        id: membership.family.id,
        name: membership.family.name,
        role: membership.role
      } : null
    });
  } catch (error) {
    next(error);
  }
});

export default router;
