import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import categoryRoutes from "./routes/category.routes.js";
import subcategoryRoutes from "./routes/subcategory.routes.js";
import productRoutes from "./routes/products.routes.js";
import cartRoutes from './routes/cart.routes.js';

const app = express();


// middlewares
app.use(cors({origin:"*"}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/api/categories', categoryRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);

// Routes
app.use('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is healthy' });
});


export default app;