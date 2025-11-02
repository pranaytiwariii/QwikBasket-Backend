import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import authRouter from "./routes/user.routes.js";
import adminRoutes from "./routes/admin.routes.js";


import categoryRoutes from "./routes/category.routes.js";
import subcategoryRoutes from "./routes/subcategory.routes.js";
import productRoutes from "./routes/products.routes.js";
import cartRoutes from './routes/cart.routes.js';
import checkoutRoutes from "./routes/checkout.routes.js";
import addressRoutes from "./routes/address.route.js";
import orderRoutes from "./routes/order.route.js";
import paymentRoutes from "./routes/payment.route.js"
import dashboardRoutes from "./routes/dashboard.routes.js"
import uploadRoutes from "./routes/upload.route.js"
const app = express();


// middlewares
app.use(cors(
    {origin: '*'}
));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/users' , authRouter)
app.use("/api/admin", adminRoutes);

app.use('/api/categories', categoryRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use("/api/checkout",checkoutRoutes);
app.use("/api/address",addressRoutes);
app.use("/api/orders",orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/dashboard",dashboardRoutes);
app.use("/api/upload", uploadRoutes);

// Routes
app.use('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is healthy' });
});

export default app;