import mongoose from 'mongoose';
import IST from "../utils/IST.js";

export const connectDB = async () => {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
        console.error('[❌] MONGO_URI environment variable is not defined.');
        process.exit(1);
    }
    try {
        await mongoose.connect(mongoURI);
        console.log(`[✅] MongoDB connected successfully at ${IST}`);
    } catch (err) {
        console.error(`[❌] MongoDB initial connection error: ${err.message}`);
        process.exit(1);
    }
    mongoose.connection.on('connected', () => {
        console.log(`[📡] Mongoose connected to DB at ${mongoose.connection.host}`);
    });

    mongoose.connection.on('error', (err) => {
        console.error(`[⚠️] Mongoose connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
        console.warn('[🔌] Mongoose disconnected');
    });

};
