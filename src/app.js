import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import cartRoutes from './routes/cart.routes.js';

const app = express();


// middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is healthy' });
});

app.use('/api/cart', cartRoutes);



export default app;