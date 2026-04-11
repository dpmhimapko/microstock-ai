import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { VertexAI } from "@google-cloud/vertexai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Route for Vertex AI (using Service Account)
  app.post("/api/vertex-ai", async (req, res) => {
    try {
      const { serviceAccount, model, prompt, mimeType, base64Data, isImageGen, aspectRatio } = req.body;

      if (!serviceAccount || !model || !prompt) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const sa = typeof serviceAccount === 'string' ? JSON.parse(serviceAccount) : serviceAccount;
      
      const vertexAI = new VertexAI({
        project: sa.project_id,
        location: "us-central1",
        googleAuthOptions: {
          credentials: {
            client_email: sa.client_email,
            private_key: sa.private_key,
          }
        }
      });

      const generativeModel = vertexAI.getGenerativeModel({
        model: model,
      });

      if (isImageGen) {
        // Vertex AI Image Generation (Imagen)
        // Note: This often uses different models like 'imagen-3.0-generate-001'
        // For Gemini models that support image gen, we use generateContent
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
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part?.inlineData) {
          return res.json({ imageUrl: `data:image/png;base64,${part.inlineData.data}` });
        }
        throw new Error("No image generated in response");
      } else {
        const parts = [];
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
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
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
