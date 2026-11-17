import { Router } from "express";
import { prisma } from "../lib/prisma.js";
const router=Router();
router.get("/",async (_request,response)=>{
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.status(200).json({status:"ok",database:"connected",timestamp:new Date().toISOString()});
  } catch {
    response.status(503).json({status:"error",database:"disconnected",timestamp:new Date().toISOString()});
  }
});
export default router;
