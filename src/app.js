import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import authRouter from "./routes/user.routes.js";



const app = express();


// middlewares
app.use(cors(
    {origin: '*'}
));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is healthy' });
});

app.use('/api/users' , authRouter)

export default app;