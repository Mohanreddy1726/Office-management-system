import mongoose from "mongoose";
import dns from "node:dns";

// Support MongoDB Atlas SRV lookups on Windows environments with restrictive local ISP DNS
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Ignore if queries are already in progress; Resolver fallback handles it below
}

async function resolveSrvUriWithPublicDns(srvUri: string): Promise<string | null> {
  if (!srvUri.startsWith("mongodb+srv://")) return null;
  try {
    const parsed = new URL(srvUri);
    const host = parsed.hostname;
    const resolver = new dns.Resolver();
    resolver.setServers(["8.8.8.8", "1.1.1.1"]);

    const srvRecords = await new Promise<dns.SrvRecord[]>((resolve, reject) => {
      resolver.resolveSrv(`_mongodb._tcp.${host}`, (err, recs) => (err ? reject(err) : resolve(recs)));
    });
    if (!srvRecords || srvRecords.length === 0) return null;

    const txtChunks = await new Promise<string[][]>((resolve) => {
      resolver.resolveTxt(host, (err, recs) => (err ? resolve([]) : resolve(recs)));
    });

    const hostsList = srvRecords.map((r) => `${r.name}:${r.port}`).join(",");
    const params = new URLSearchParams(parsed.searchParams.toString());
    for (const chunk of txtChunks) {
      const txtParams = new URLSearchParams(chunk.join(""));
      txtParams.forEach((v, k) => {
        if (!params.has(k)) params.set(k, v);
      });
    }
    if (!params.has("tls") && !params.has("ssl")) {
      params.set("tls", "true");
    }

    const auth = parsed.username
      ? `${encodeURIComponent(decodeURIComponent(parsed.username))}:${encodeURIComponent(decodeURIComponent(parsed.password))}@`
      : "";
    const dbPath = parsed.pathname || "/";
    return `mongodb://${auth}${hostsList}${dbPath}?${params.toString()}`;
  } catch (err) {
    console.warn("[MongoDB] Public DNS SRV fallback failed:", err);
    return null;
  }
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

    cached.promise = (async () => {
      try {
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
      } catch {}

      try {
        const m = await mongoose.connect(MONGODB_URI, opts);
        const dbHost = MONGODB_URI.split("@").pop()?.split("?")[0] || "database";
        console.log(`[MongoDB] Connected successfully to ${dbHost}`);
        return m;
      } catch (err: any) {
        const msg = err?.message || "";
        if (msg.includes("querySrv") || msg.includes("ECONNREFUSED") || msg.includes("ETIMEOUT")) {
          const directUri = await resolveSrvUriWithPublicDns(MONGODB_URI);
          if (directUri) {
            try {
              const m = await mongoose.connect(directUri, opts);
              console.log("[MongoDB] Connected successfully via public DNS SRV resolver");
              return m;
            } catch (directErr: any) {
              console.warn(`[MongoDB] Direct connection failed (${directErr?.message}). Using in-memory fallback store.`);
              cached.promise = null;
              return null;
            }
          }
        }
        console.warn(`[MongoDB] Database not reachable (${msg}). Using in-memory fallback store.`);
        cached.promise = null; // allow retrying on subsequent requests
        return null;
      }
    })();
  }

  try {
    cached.conn = await cached.promise;
  } catch {
    cached.promise = null;
    return null;
  }

  return cached.conn;
}
