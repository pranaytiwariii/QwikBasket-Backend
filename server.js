import {connectDB} from "./src/config/db.js";
import app  from "./src/app.js";
import dotenv from "dotenv";
import IST from "./src/utils/IST.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const startServer = async () => {
    try {
      // Connect to database first
      await connectDB();
      console.log('✅ Database connected successfully');
      
      // Start the server
      app.listen(PORT, () => {
        console.log(`[🚀] Server is running on port ${PORT} at ${IST}`);
        console.log(`[🌐] Health check: http://localhost:${PORT}/api/health`);
        console.log(`[📚] API Base URL: http://localhost:${PORT}/api`);
      });
      
    } catch (error) {
      console.error(`[❌] Failed to start server: ${error.message}`);
      process.exit(1);
    }
  };
  startServer();
