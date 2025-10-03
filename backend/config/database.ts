import mongoose from "mongoose";
import { config } from "dotenv";

config();

const connectDB = async (): Promise<void> => {
    try {
        const dbConnection = await mongoose.connect(process.env.MONGODB_URI as string);
        console.log(`MongoDB Connected: ${dbConnection.connection.host}`);
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
};

export default connectDB;