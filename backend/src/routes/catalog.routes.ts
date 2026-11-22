import { Router, type Response } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
router.use(requireAuth);

function userId(response: Response) {
  return response.locals.userId as string;
}

function textField(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}

function handleUniqueError(error: unknown, response: Response) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    response.status(409).json({ error: "A record with those details already exists." });
    return true;
  }
  return false;
}

// Categories
router.get("/categories", async (_request, response, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } }
    });
    response.json({ categories });
  } catch (error) {
    next(error);
  }
});

router.post("/categories", async (request, response, next) => {
  try {
    userId(response);
    const { name, parentId } = request.body ?? {};
    if (!textField(name, 80)) {
      response.status(400).json({ error: "Category name must contain 1 to 80 characters." });
      return;
    }
    if (parentId !== undefined && parentId !== null && typeof parentId !== "string") {
      response.status(400).json({ error: "Invalid parent category." });
      return;
    }
    if (typeof parentId === "string" && parentId) {
      const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { id: true } });
      if (!parent) {
        response.status(404).json({ error: "Parent category not found." });
        return;
      }
    }
    const category = await prisma.category.create({
      data: { name: name.trim(), parentId: parentId || null }
    });
    response.status(201).json({ category });
  } catch (error) {
    if (handleUniqueError(error, response)) return;
    next(error);
  }
});


router.patch("/categories/:categoryId", async (request, response, next) => {
  try {
    const { name } = request.body ?? {};
    if (!textField(name, 80)) { response.status(400).json({ error: "Category name must contain 1 to 80 characters." }); return; }
    const category = await prisma.category.update({ where: { id: request.params.categoryId }, data: { name: name.trim() } });
    response.json({ category });
  } catch (error) { if (handleUniqueError(error, response)) return; next(error); }
});
router.delete("/categories/:categoryId", async (request, response, next) => {
  try {
    const category = await prisma.category.findUnique({ where: { id: request.params.categoryId }, include: { _count: { select: { products: true, children: true } } } });
    if (!category) { response.status(404).json({ error: "Category not found." }); return; }
    if (category._count.products || category._count.children) { response.status(409).json({ error: "This category is in use. Move its products and child categories before deleting it." }); return; }
    await prisma.category.delete({ where: { id: category.id } });
    response.status(204).end();
  } catch (error) { next(error); }
});

// Supermarket directory
router.get("/supermarkets", async (_request, response, next) => {
  try {
    const supermarkets = await prisma.supermarket.findMany({
      orderBy: [{ name: "asc" }, { chain: "asc" }],
      include: {
        _count: { select: { offers: true, prices: true } }
      }
    });
    response.json({ supermarkets });
  } catch (error) {
    next(error);
  }
});

router.post("/supermarkets", async (request, response, next) => {
  try {
    userId(response);
    const { name, chain, website } = request.body ?? {};
    if (!textField(name, 100) ||
        (chain !== undefined && chain !== null && (typeof chain !== "string" || chain.trim().length > 100)) ||
        (website !== undefined && website !== null && (typeof website !== "string" || website.trim().length > 300))) {
      response.status(400).json({ error: "Provide a supermarket name, with optional chain and website." });
      return;
    }
    if (website && !/^https?:\/\//i.test(website)) {
      response.status(400).json({ error: "Website must start with http:// or https://." });
      return;
    }
    const supermarket = await prisma.supermarket.create({
      data: {
        name: name.trim(),
        chain: typeof chain === "string" && chain.trim() ? chain.trim() : null,
        website: typeof website === "string" && website.trim() ? website.trim() : null
      }
    });
    response.status(201).json({ supermarket });
  } catch (error) {
    if (handleUniqueError(error, response)) return;
    next(error);
  }
});


router.patch("/supermarkets/:supermarketId", async (request, response, next) => {
  try {
    const { name, chain, website } = request.body ?? {};
    if (!textField(name, 100) || (chain !== undefined && chain !== null && (typeof chain !== "string" || chain.trim().length > 100)) || (website !== undefined && website !== null && (typeof website !== "string" || website.trim().length > 300))) { response.status(400).json({ error: "Provide a valid name, chain and website." }); return; }
    if (website && !/^https?:\/\//i.test(website)) { response.status(400).json({ error: "Website must start with http:// or https://." }); return; }
    const supermarket = await prisma.supermarket.update({ where: { id: request.params.supermarketId }, data: { name: name.trim(), chain: typeof chain === "string" && chain.trim() ? chain.trim() : null, website: typeof website === "string" && website.trim() ? website.trim() : null } });
    response.json({ supermarket });
  } catch (error) { if (handleUniqueError(error, response)) return; next(error); }
});
router.delete("/supermarkets/:supermarketId", async (request, response, next) => {
  try {
    const supermarket = await prisma.supermarket.findUnique({ where: { id: request.params.supermarketId }, include: { _count: { select: { prices: true } } } });
    if (!supermarket) { response.status(404).json({ error: "Supermarket not found." }); return; }
    if (supermarket._count.prices) { response.status(409).json({ error: "This supermarket has price history and cannot be deleted without losing historical records." }); return; }
    await prisma.supermarket.delete({ where: { id: supermarket.id } });
    response.status(204).end();
  } catch (error) { next(error); }
});

// Product catalogue
router.get("/products", async (request, response, next) => {
  try {
    const q = typeof request.query.q === "string" ? request.query.q.trim().slice(0, 100) : "";
    const categoryId = typeof request.query.categoryId === "string" ? request.query.categoryId : undefined;
    const limitValue = Number(request.query.limit ?? 30);
    const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 100) : 30;
    const products = await prisma.product.findMany({
      where: {
        ...(q ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
            { barcode: { contains: q } }
          ]
        } : {}),
        ...(categoryId ? { categoryId } : {})
      },
      take: limit,
      orderBy: [{ name: "asc" }, { brand: "asc" }],
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { supermarketOffers: true, listItems: true } }
      }
    });
    const observations = products.length ? await prisma.priceObservation.findMany({
      where: { productId: { in: products.map((product) => product.id) } },
      orderBy: { observedAt: "desc" },
      include: { supermarket: { select: { id: true, name: true, chain: true } } }
    }) : [];
    const seen = new Set<string>();
    const latestPrices = observations.filter((observation) => {
      const key = observation.supermarketId + ":" + observation.productId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    response.json({
      products: products.map((product) => ({
        ...product,
        priceObservations: latestPrices.filter((observation) => observation.productId === product.id)
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.post("/products", async (request, response, next) => {
  try {
    userId(response);
    const { name, brand, barcode, description, categoryId, unit, quantity } = request.body ?? {};
    if (!textField(name, 150) || !textField(categoryId, 64) ||
        (brand !== undefined && brand !== null && (typeof brand !== "string" || brand.trim().length > 100)) ||
        (barcode !== undefined && barcode !== null && (typeof barcode !== "string" || barcode.trim().length > 64)) ||
        (description !== undefined && description !== null && (typeof description !== "string" || description.length > 1000)) ||
        (categoryId !== undefined && categoryId !== null && typeof categoryId !== "string") ||
        (unit !== undefined && unit !== null && (typeof unit !== "string" || unit.trim().length > 30))) {
      response.status(400).json({ error: "A product name and category are required. Check the other optional product details too." });
      return;
    }
    let parsedQuantity: Prisma.Decimal | null = null;
    if (quantity !== undefined && quantity !== null && quantity !== "") {
      const numericQuantity = Number(quantity);
      if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || numericQuantity > 9999999.999 ||
          !Number.isInteger(numericQuantity * 1000)) {
        response.status(400).json({ error: "Product quantity must be positive with up to 3 decimal places." });
        return;
      }
      parsedQuantity = new Prisma.Decimal(numericQuantity);
    }
    {
      const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
      if (!category) {
        response.status(404).json({ error: "Category not found." });
        return;
      }
    }
    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        brand: typeof brand === "string" && brand.trim() ? brand.trim() : null,
        barcode: typeof barcode === "string" && barcode.trim() ? barcode.trim() : null,
        description: typeof description === "string" && description.trim() ? description.trim() : null,
        categoryId,
        unit: typeof unit === "string" && unit.trim() ? unit.trim() : null,
        quantity: parsedQuantity
      },
      include: { category: { select: { id: true, name: true } } }
    });
    response.status(201).json({ product });
  } catch (error) {
    if (handleUniqueError(error, response)) return;
    next(error);
  }
});


router.patch("/products/:productId", async (request, response, next) => {
  try {
    const { name, brand, barcode, description, categoryId, unit, quantity } = request.body ?? {};
    if (!textField(name, 150) || !textField(categoryId, 64) ||
      (brand !== undefined && brand !== null && (typeof brand !== "string" || brand.trim().length > 100)) ||
      (barcode !== undefined && barcode !== null && (typeof barcode !== "string" || barcode.trim().length > 64)) ||
      (description !== undefined && description !== null && (typeof description !== "string" || description.length > 1000)) ||
      (unit !== undefined && unit !== null && (typeof unit !== "string" || unit.trim().length > 30))) { response.status(400).json({ error: "Provide a product name and valid category and optional details." }); return; }
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) { response.status(404).json({ error: "Category not found." }); return; }
    let parsedQuantity: Prisma.Decimal | null = null;
    if (quantity !== undefined && quantity !== null && quantity !== "") {
      const n = Number(quantity);
      if (!Number.isFinite(n) || n <= 0 || n > 9999999.999 || !Number.isInteger(n * 1000)) { response.status(400).json({ error: "Quantity must be positive with up to 3 decimal places." }); return; }
      parsedQuantity = new Prisma.Decimal(n);
    }
    const product = await prisma.product.update({ where: { id: request.params.productId }, data: { name: name.trim(), brand: typeof brand === "string" && brand.trim() ? brand.trim() : null, barcode: typeof barcode === "string" && barcode.trim() ? barcode.trim() : null, description: typeof description === "string" && description.trim() ? description.trim() : null, categoryId, unit: typeof unit === "string" && unit.trim() ? unit.trim() : null, quantity: parsedQuantity }, include: { category: { select: { id: true, name: true } } } });
    response.json({ product });
  } catch (error) { if (handleUniqueError(error, response)) return; next(error); }
});
router.delete("/products/:productId", async (request, response, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: request.params.productId }, include: { _count: { select: { priceObservations: true, listItems: true } } } });
    if (!product) { response.status(404).json({ error: "Product not found." }); return; }
    if (product._count.priceObservations || product._count.listItems) { response.status(409).json({ error: "This product is referenced by shopping lists or price history. Remove those records before deleting it." }); return; }
    await prisma.product.delete({ where: { id: product.id } });
    response.status(204).end();
  } catch (error) { next(error); }
});

// Latest recorded prices for a product, grouped by supermarket in the response.
router.get("/products/:productId/prices", async (request, response, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: request.params.productId },
      select: { id: true, name: true, brand: true }
    });
    if (!product) {
      response.status(404).json({ error: "Product not found." });
      return;
    }
    const observations = await prisma.priceObservation.findMany({
      where: { productId: product.id },
      orderBy: { observedAt: "desc" },
      take: 100,
      include: { supermarket: { select: { id: true, name: true, chain: true, website: true } } }
    });
    const latestBySupermarket = new Map<string, typeof observations[number]>();
    for (const observation of observations) {
      if (!latestBySupermarket.has(observation.supermarketId)) {
        latestBySupermarket.set(observation.supermarketId, observation);
      }
    }
    response.json({ product, prices: [...latestBySupermarket.values()] });
  } catch (error) {
    next(error);
  }
});


router.patch("/prices/:priceId", async (request, response, next) => {
  try {
    const { price, currency } = request.body ?? {};
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0 || price > 99999999.99 ||
        typeof currency !== "string" || !/^[A-Za-z]{3}$/.test(currency)) {
      response.status(400).json({ error: "Provide a valid non-negative price and 3-letter currency code." }); return;
    }
    const existing = await prisma.priceObservation.findUnique({ where: { id: request.params.priceId }, select: { id: true } });
    if (!existing) { response.status(404).json({ error: "Price observation not found." }); return; }
    const observation = await prisma.priceObservation.update({
      where: { id: existing.id },
      data: { price: new Prisma.Decimal(price), currency: currency.toUpperCase() },
      include: { supermarket: { select: { id: true, name: true, chain: true } } }
    });
    response.json({ observation });
  } catch (error) { next(error); }
});

router.delete("/prices/:priceId", async (request, response, next) => {
  try {
    const existing = await prisma.priceObservation.findUnique({ where: { id: request.params.priceId }, select: { id: true } });
    if (!existing) { response.status(404).json({ error: "Price observation not found." }); return; }
    await prisma.priceObservation.delete({ where: { id: existing.id } });
    response.status(204).end();
  } catch (error) { next(error); }
});

// Record a manual or imported price observation and keep the supermarket offer in sync.
router.post("/products/:productId/prices", async (request, response, next) => {
  try {
    const recordedBy = userId(response);
    const { supermarketId, price, currency = "EUR", source } = request.body ?? {};
    if (typeof supermarketId !== "string" || typeof price !== "number" ||
        !Number.isFinite(price) || price < 0 || price > 99999999.99 ||
        !/^[A-Za-z]{3}$/.test(currency) ||
        (source !== undefined && source !== null && (typeof source !== "string" || source.trim().length > 100))) {
      response.status(400).json({ error: "Provide a supermarket, a valid non-negative price, and a 3-letter currency code." });
      return;
    }
    const product = await prisma.product.findUnique({ where: { id: request.params.productId }, select: { id: true } });
    if (!product) {
      response.status(404).json({ error: "Product not found." });
      return;
    }
    const supermarket = await prisma.supermarket.findUnique({ where: { id: supermarketId }, select: { id: true } });
    if (!supermarket) {
      response.status(404).json({ error: "Supermarket not found." });
      return;
    }
    const observation = await prisma.$transaction(async (transaction) => {
      await transaction.supermarketProduct.upsert({
        where: { supermarketId_productId: { supermarketId, productId: product.id } },
        create: { supermarketId, productId: product.id, isAvailable: true },
        update: { isAvailable: true }
      });
      return transaction.priceObservation.create({
        data: {
          productId: product.id,
          supermarketId,
          price: new Prisma.Decimal(price),
          currency: currency.toUpperCase(),
          source: typeof source === "string" && source.trim() ? source.trim() : `user:${recordedBy}`
        },
        include: { supermarket: { select: { id: true, name: true, chain: true } } }
      });
    });
    response.status(201).json({ observation });
  } catch (error) {
    next(error);
  }
});

export default router;
