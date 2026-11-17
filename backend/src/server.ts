import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes';

const app = express();
const port = Number(process.env.PORT ?? 5002);

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json());
app.use('/api/health', healthRoutes);

app.listen(port, () => {
  console.log(`ShoppingMarket API listening on port ${port}`);
});
