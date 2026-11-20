import "dotenv/config";
import app from "./app.js";
import { prisma } from "./lib/prisma.js";
const port=Number.parseInt(process.env.PORT??"5005",10);
if(!Number.isInteger(port)||port<1||port>65535) throw new Error("PORT must be a valid TCP port.");
const server=app.listen(port,()=>console.log(`ShoppingMarket API listening on http://localhost:${port}`));
const shutdown=(signal:string)=>{
  console.log(`${signal} received. Shutting down gracefully.`);
  server.close(()=>{void prisma.$disconnect().finally(()=>process.exit(0));});
};
process.on("SIGINT",()=>shutdown("SIGINT"));
process.on("SIGTERM",()=>shutdown("SIGTERM"));
