import { Router } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
const LIST_STATUSES = ["ACTIVE", "COMPLETED", "ARCHIVED"] as const;
const ITEM_STATUSES = ["TO_BUY", "IN_CART", "PURCHASED", "UNAVAILABLE"] as const;

type ListStatus = typeof LIST_STATUSES[number];
type ItemStatus = typeof ITEM_STATUSES[number];

function currentUserId(response: Parameters<Parameters<typeof router.get>[1]>[1]) {
  return response.locals.userId as string;
}

function validQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    value > 0 && value <= 9999999.999 &&
    Number.isInteger(value * 1000);
}

async function accessibleList(listId: string, userId: string) {
  return prisma.shoppingList.findFirst({
    where: {
      id: listId,
      family: { memberships: { some: { userId } } }
    }
  });
}

router.use(requireAuth);

// Lists are always scoped to families the authenticated user belongs to.
router.get("/", async (_request, response, next) => {
  try {
    const userId = currentUserId(response);
    const memberships = await prisma.familyMember.findMany({
      where: { userId },
      select: { familyId: true }
    });
    const familyIds = memberships.map((membership) => membership.familyId);
    const lists = await prisma.shoppingList.findMany({
      where: { familyId: { in: familyIds } },
      include: {
        family: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true } },
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { product: { select: { id: true, name: true, brand: true } } }
        }
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
    });
    response.json({ lists });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (request, response, next) => {
  try {
    const userId = currentUserId(response);
    const { name, familyId, dueAt } = request.body ?? {};
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100 ||
        typeof familyId !== "string") {
      response.status(400).json({ error: "A family and a list name (up to 100 characters) are required." });
      return;
    }
    const membership = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } }
    });
    if (!membership) {
      response.status(403).json({ error: "You do not have access to this family." });
      return;
    }
    let parsedDueAt: Date | null = null;
    if (dueAt !== undefined && dueAt !== null && dueAt !== "") {
      parsedDueAt = new Date(dueAt);
      if (Number.isNaN(parsedDueAt.getTime())) {
        response.status(400).json({ error: "Please provide a valid due date." });
        return;
      }
    }
    const list = await prisma.shoppingList.create({
      data: { name: name.trim(), familyId, createdById: userId, dueAt: parsedDueAt },
      include: {
        family: { select: { id: true, name: true } },
        items: true,
        _count: { select: { items: true } }
      }
    });
    response.status(201).json({ list });
  } catch (error) {
    next(error);
  }
});

router.patch("/:listId", async (request, response, next) => {
  try {
    const userId = currentUserId(response);
    const list = await accessibleList(request.params.listId, userId);
    if (!list) {
      response.status(404).json({ error: "Shopping list not found." });
      return;
    }
    const { name, status, dueAt } = request.body ?? {};
    const data: { name?: string; status?: ListStatus; dueAt?: Date | null; completedAt?: Date | null } = {};
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
        response.status(400).json({ error: "List name must be between 1 and 100 characters." });
        return;
      }
      data.name = name.trim();
    }
    if (status !== undefined) {
      if (!LIST_STATUSES.includes(status)) {
        response.status(400).json({ error: "Invalid shopping list status." });
        return;
      }
      data.status = status;
      data.completedAt = status === "COMPLETED" ? new Date() : null;
    }
    if (dueAt !== undefined) {
      if (dueAt === null || dueAt === "") data.dueAt = null;
      else {
        const date = new Date(dueAt);
        if (Number.isNaN(date.getTime())) {
          response.status(400).json({ error: "Please provide a valid due date." });
          return;
        }
        data.dueAt = date;
      }
    }
    if (Object.keys(data).length === 0) {
      response.status(400).json({ error: "There are no valid changes to save." });
      return;
    }
    const updated = await prisma.shoppingList.update({
      where: { id: list.id },
      data,
      include: {
        family: { select: { id: true, name: true } },
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { product: { select: { id: true, name: true, brand: true } } }
        },
        _count: { select: { items: true } }
      }
    });
    response.json({ list: updated });
  } catch (error) {
    next(error);
  }
});

router.post("/:listId/items", async (request, response, next) => {
  try {
    const userId = currentUserId(response);
    const list = await accessibleList(request.params.listId, userId);
    if (!list) {
      response.status(404).json({ error: "Shopping list not found." });
      return;
    }
    const { name, productId, quantity = 1, notes } = request.body ?? {};
    if ((typeof name !== "string" || !name.trim()) && typeof productId !== "string") {
      response.status(400).json({ error: "Enter an item name or select a product." });
      return;
    }
    if ((typeof name === "string" && name.trim().length > 150) || !validQuantity(quantity) ||
        (notes !== undefined && notes !== null && (typeof notes !== "string" || notes.length > 500))) {
      response.status(400).json({ error: "Check the item name, quantity (up to 3 decimal places), and notes (up to 500 characters)." });
      return;
    }
    if (productId !== undefined) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        response.status(404).json({ error: "The selected product could not be found." });
        return;
      }
    }
    const highest = await prisma.shoppingListItem.aggregate({
      where: { shoppingListId: list.id },
      _max: { sortOrder: true }
    });
    const item = await prisma.shoppingListItem.create({
      data: {
        shoppingListId: list.id,
        addedById: userId,
        customName: typeof name === "string" && name.trim() ? name.trim() : null,
        productId: typeof productId === "string" ? productId : null,
        quantity: new Prisma.Decimal(quantity),
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
        sortOrder: (highest._max.sortOrder ?? -1) + 1
      },
      include: { product: { select: { id: true, name: true, brand: true } } }
    });
    response.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

router.patch("/:listId/items/:itemId", async (request, response, next) => {
  try {
    const userId = currentUserId(response);
    const list = await accessibleList(request.params.listId, userId);
    if (!list) {
      response.status(404).json({ error: "Shopping list not found." });
      return;
    }
    const existing = await prisma.shoppingListItem.findFirst({
      where: { id: request.params.itemId, shoppingListId: list.id }
    });
    if (!existing) {
      response.status(404).json({ error: "Shopping list item not found." });
      return;
    }
    const { name, quantity, notes, status } = request.body ?? {};
    const data: {
      customName?: string | null;
      quantity?: Prisma.Decimal;
      notes?: string | null;
      status?: ItemStatus;
    } = {};
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim() || name.trim().length > 150) {
        response.status(400).json({ error: "Item name must be between 1 and 150 characters." });
        return;
      }
      data.customName = name.trim();
    }
    if (quantity !== undefined) {
      if (!validQuantity(quantity)) {
        response.status(400).json({ error: "Quantity must be greater than zero with up to 3 decimal places." });
        return;
      }
      data.quantity = new Prisma.Decimal(quantity);
    }
    if (notes !== undefined) {
      if (notes !== null && (typeof notes !== "string" || notes.length > 500)) {
        response.status(400).json({ error: "Notes must be 500 characters or fewer." });
        return;
      }
      data.notes = typeof notes === "string" && notes.trim() ? notes.trim() : null;
    }
    if (status !== undefined) {
      if (!ITEM_STATUSES.includes(status)) {
        response.status(400).json({ error: "Invalid shopping item status." });
        return;
      }
      data.status = status;
    }
    if (Object.keys(data).length === 0) {
      response.status(400).json({ error: "There are no valid changes to save." });
      return;
    }
    const item = await prisma.shoppingListItem.update({
      where: { id: existing.id },
      data,
      include: { product: { select: { id: true, name: true, brand: true } } }
    });
    response.json({ item });
  } catch (error) {
    next(error);
  }
});

router.delete("/:listId/items/:itemId", async (request, response, next) => {
  try {
    const userId = currentUserId(response);
    const list = await accessibleList(request.params.listId, userId);
    if (!list) {
      response.status(404).json({ error: "Shopping list not found." });
      return;
    }
    const item = await prisma.shoppingListItem.findFirst({
      where: { id: request.params.itemId, shoppingListId: list.id },
      select: { id: true }
    });
    if (!item) {
      response.status(404).json({ error: "Shopping list item not found." });
      return;
    }
    await prisma.shoppingListItem.delete({ where: { id: item.id } });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
