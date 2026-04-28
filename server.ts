import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { VertexAI } from "@google-cloud/vertexai";
import { GoogleGenAI } from "@google/genai";

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

  // Health check - always available
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Express server is alive and healthy" });
  });

  // API Route for Vertex AI (using Service Account)
  app.post("/api/vertex-ai", async (req, res) => {
    console.log(`[API] Vertex AI request received for model: ${req.body.model}`);
    try {
      const { serviceAccount, model, prompt, mimeType, base64Data, isImageGen, aspectRatio } = req.body;

      if (!serviceAccount) return res.status(400).json({ error: "Service Account JSON is required" });
      if (!model) return res.status(400).json({ error: "Model name is required" });
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });

      let sa: any;
      try {
        sa = typeof serviceAccount === 'string' ? JSON.parse(serviceAccount) : serviceAccount;
      } catch (e) {
        return res.status(400).json({ error: "Format JSON Service Account tidak valid." });
      }
      
      // Fix private key formatting
      if (sa.private_key && typeof sa.private_key === 'string' && sa.private_key.includes('\\n')) {
        sa.private_key = sa.private_key.replace(/\\n/g, '\n');
      }

      console.log(`[Vertex] Initializing with project: ${sa.project_id || sa.project}`);

      const vertexAI = new VertexAI({
        project: sa.project_id || sa.project,
        location: sa.location || "us-central1",
        googleAuthOptions: {
          credentials: sa
        }
      });

      // Map models for Vertex AI
      let vertexModelName = "gemini-1.5-flash";
      if (model.includes('pro')) {
        vertexModelName = 'gemini-1.5-pro';
      }
      
      // Allow passing direct model names
      if (model.startsWith('gemini-1.5') || model.startsWith('gemini-1.0')) {
        vertexModelName = model;
      }

      console.log(`[Vertex] Using model: ${vertexModelName}`);

      const generativeModel = vertexAI.getGenerativeModel({
        model: vertexModelName,
      });

      if (isImageGen) {
        console.log("[Vertex] Generating image content...");
        const result = await generativeModel.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            // @ts-ignore
            imageConfig: {
              aspectRatio: aspectRatio || "1:1",
            }
          }
        });
        const response = await result.response;
        const parts = response.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find(p => p.inlineData);
        
        if (imagePart?.inlineData) {
          return res.json({ imageUrl: `data:image/png;base64,${imagePart.inlineData.data}` });
        }
        
        throw new Error(`Model ${vertexModelName} tidak mengembalikan data gambar. Pastikan project Anda memiliki akses ke model multimodal.`);
      } else {
        const parts: any[] = [];
        if (base64Data && mimeType) {
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          });
        }
        parts.push({ text: prompt });

        const result = await generativeModel.generateContent({
          contents: [{ role: "user", parts }],
        });

        const response = await result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || 
                    response.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || "";
        
        if (!text && response.candidates?.[0]?.finishReason) {
          throw new Error(`Model berhenti dengan alasan: ${response.candidates[0].finishReason}`);
        }

        res.json({ text });
      }
    } catch (error: any) {
      console.error("[Vertex AI Error]:", error);
      res.status(500).json({ 
        error: error.message || "Kesalahan internal pada Vertex AI.",
        details: error.stack
      });
    }
  });

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

  // Start listening EARLY
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server process started on http://0.0.0.0:${PORT}`);
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
