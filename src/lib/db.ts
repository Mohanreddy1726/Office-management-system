import mongoose from "mongoose";
import dns from "node:dns";

// Support MongoDB Atlas SRV lookups on Windows environments with restrictive local ISP DNS
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Ignore in environments where setting custom DNS servers is restricted
}

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://mohanreddy:mohanreddy1726@cluster0.5ghmukt.mongodb.net/rendesk?retryWrites=true&w=majority";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose | null> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = globalThis.mongooseCache || {
  conn: null,
  promise: null,
};

if (!globalThis.mongooseCache) {
  globalThis.mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose | null> {
  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000, // 8-second timeout for cloud Atlas DNS & SSL handshake
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((m) => {
        const dbHost = MONGODB_URI.split("@").pop()?.split("?")[0] || "database";
        console.log(`[MongoDB] Connected successfully to ${dbHost}`);
        return m;
      })
      .catch((err) => {
        console.warn(`[MongoDB] Database not reachable (${err.message}). Using in-memory fallback store.`);
        cached.promise = null; // allow retrying on subsequent requests
        return null;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch {
    cached.promise = null;
    return null;
  }

  return cached.conn;
}
