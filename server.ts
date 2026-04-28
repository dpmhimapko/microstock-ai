import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { VertexAI } from "@google-cloud/vertexai";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running" });
  });

  // API Route for Vertex AI (using Service Account)
  app.post("/api/vertex-ai", async (req, res) => {
    console.log("Received Vertex AI request:", req.body.model);
    try {
      const { serviceAccount, model, prompt, mimeType, base64Data, isImageGen, aspectRatio } = req.body;

      if (!serviceAccount || !model || !prompt) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      let sa: any;
      try {
        sa = typeof serviceAccount === 'string' ? JSON.parse(serviceAccount) : serviceAccount;
      } catch (e) {
        return res.status(400).json({ error: "Invalid Service Account JSON. Pastikan format JSON benar." });
      }
      
      // Fix private key formatting if needed
      if (sa.private_key && typeof sa.private_key === 'string' && sa.private_key.includes('\\n')) {
        sa.private_key = sa.private_key.replace(/\\n/g, '\n');
      }

      const vertexAI = new VertexAI({
        project: sa.project_id || sa.project,
        location: sa.location || "us-central1",
        googleAuthOptions: {
          credentials: sa
        }
      });

      // Map aliases to actual Vertex AI model names
      let vertexModelName = model;
      if (model.includes('flash') || model.includes('lite')) {
        vertexModelName = 'gemini-1.5-flash';
      } else if (model.includes('pro')) {
        vertexModelName = 'gemini-1.5-pro';
      } else if (model.includes('image')) {
        vertexModelName = 'gemini-1.5-flash'; // Vertex use flash for image output often via generateContent
      }
      
      // Priority models if they exist in Vertex
      if (model === 'gemini-1.5-flash' || model === 'gemini-1.5-pro') {
        vertexModelName = model;
      }

      const generativeModel = vertexAI.getGenerativeModel({
        model: vertexModelName,
      });

      if (isImageGen) {
        // Vertex AI Image Gen via Gemini 1.5 Flash (standard approach)
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
        // Search for inlineData in candidate parts
        const parts = response.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find(p => p.inlineData);
        
        if (imagePart?.inlineData) {
          return res.json({ imageUrl: `data:image/png;base64,${imagePart.inlineData.data}` });
        }
        
        // Some responses might have it in different structure
        throw new Error(`Tidak ada gambar yang dihasilkan oleh model ${vertexModelName}. Pastikan model mendukung output gambar.`);
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
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
        res.json({ text });
      }
    } catch (error: any) {
      console.error("Vertex AI Error:", error);
      res.status(500).json({ error: error.message || "Terjadi kesalahan pada Vertex AI. Periksa JSON Service Account atau kuota project Anda." });
    }
  });

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global Server Error:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
