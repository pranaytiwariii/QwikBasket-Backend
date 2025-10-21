import {connectDB} from "./src/config/db.js";
import app  from "./src/app.js";
import dotenv from "dotenv";
import IST from "./src/utils/IST.js";

dotenv.config();

const PORT = process.env.PORT || 8080;
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`[🚀] Server is running on port ${PORT} at ${IST}`);
        console.log(`[🌐] Health check: http://localhost:${PORT}/api/health`);
        console.log(`[📚] API Base URL: http://localhost:${PORT}/api`);
    });
}).catch(err => {
    console.error(`[❌] Failed to connect to the database: ${err.message}`);
    process.exit(1);
});