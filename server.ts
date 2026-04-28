import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import healthHandler from "./api/health";
import vertexHandler from "./api/vertex-ai";
import tokenHandler from "./api/get-token";

// Error reporting for the server process
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API Routes using the shared handlers
  app.get("/api/health", healthHandler);
  app.post("/api/vertex-ai", vertexHandler);
  app.post("/api/get-token", tokenHandler);

  // Catch-all for API routes that are NOT handled above
  app.all('/api/*', (req, res) => {
    console.warn(`[404] API Route not found: ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: "Route API tidak ditemukan di server backend.",
      method: req.method,
      url: req.url 
    });
  });

  // Global error handler for API routes
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[Global Error Handler]:", err);
    res.status(err.status || 500).json({ 
      error: err.message || "Internal Server Error",
      path: req.path
    });
  });

  // Start listening
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started on http://0.0.0.0:${PORT}`);
    console.log(`- Health: http://0.0.0.0:${PORT}/api/health`);
    console.log(`- Vertex: http://0.0.0.0:${PORT}/api/vertex-ai`);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("[Vite] Initializing Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

startServer().catch(err => {
  console.error("FATAL: Failed to start server:", err);
});
