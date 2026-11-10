import dns from "node:dns";
import mongoose from "mongoose";

// Set public DNS servers to resolve MongoDB Atlas SRV records
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const uri = "mongodb+srv://mohanreddy:mohanreddy1726@cluster0.5ghmukt.mongodb.net/rendesk?retryWrites=true&w=majority";

console.log("Connecting to MongoDB Atlas with public DNS fallback...");
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log("SUCCESS! Connected to MongoDB Atlas. Database name:", mongoose.connection.name);
  console.log("ReadyState:", mongoose.connection.readyState);
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("Collections in DB:", collections.map((c) => c.name));
  await mongoose.disconnect();
  console.log("Disconnected cleanly.");
} catch (err) {
  console.error("Connection failed:", err.message);
  process.exit(1);
}
