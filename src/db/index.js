import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

// Variable to store the cached connection instance
let cachedConnection = null;

const connectDB = async () => {
    try {
        // Check if there is already a cached connection and if it's connected
        if (cachedConnection && mongoose.connection.readyState === 1) {
            console.log("Already connected to MongoDB (cached)");
            return cachedConnection; // Return the cached connection
        }

        // If no cached connection exists or if not connected, create a new one
        cachedConnection = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`   );

        console.log(`\nMongoDB connected !! DB HOST : ${cachedConnection.connection.host}`);
        return cachedConnection; // Return the new connection and cache it
    } catch (error) {
        console.log("MongoDB connection error: ", error);
        process.exit(1);
    }
};

export default connectDB;
