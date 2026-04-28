import { VertexAI } from "@google-cloud/vertexai";

export default async function handler(req: any, res: any) {
  // Support both Express and Vercel
  const body = req.body;
  const method = req.method;

  if (method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { serviceAccount, model, prompt, mimeType, base64Data, isImageGen, aspectRatio, location } = body;

    if (!serviceAccount) return res.status(400).json({ error: "Service Account JSON is required" });
    if (!model) return res.status(400).json({ error: "Model name is required" });
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    let sa: any;
    try {
      sa = typeof serviceAccount === 'string' ? JSON.parse(serviceAccount) : serviceAccount;
    } catch (e) {
      return res.status(400).json({ error: "Format JSON Service Account tidak valid." });
    }

    // Fix private key
    if (sa.private_key && typeof sa.private_key === 'string' && sa.private_key.includes('\\n')) {
      sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    }

    const vertexAI = new VertexAI({
      project: sa.project_id || sa.project,
      location: location || sa.location || "us-central1",
      googleAuthOptions: {
        credentials: sa
      }
    });

    let vertexModelName = "gemini-1.5-flash";
    if (model.includes('pro')) {
      vertexModelName = 'gemini-1.5-pro';
    }
    if (model.startsWith('gemini-1.5') || model.startsWith('gemini-1.0')) {
      vertexModelName = model;
    }

    const generativeModel = vertexAI.getGenerativeModel({
      model: vertexModelName,
    });

    try {
      if (isImageGen) {
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
        throw new Error(`Model ${vertexModelName} tidak mengembalikan data gambar.`);
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
                    response.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || "";
        
        if (!text && response.candidates?.[0]?.finishReason) {
          throw new Error(`Model berhenti dengan alasan: ${response.candidates[0].finishReason}`);
        }

        return res.json({ text });
      }
    } catch (vertexError: any) {
      console.warn("[Vertex Fallback] Vertex AI failed, trying Gemini REST API...", vertexError.message);
      
      // Fallback to Gemini REST API using OAuth token from Service Account
      try {
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth({
          credentials: sa,
          scopes: ['https://www.googleapis.com/auth/generative-language', 'https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        const token = tokenResponse.token;

        if (!token) throw new Error("Gagal mengambil OAuth token untuk fallback.");

        // Clean model name for Gemini API
        let geminiModelName = vertexModelName;
        if (!geminiModelName.startsWith('models/')) {
          geminiModelName = `models/${geminiModelName}`;
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/${geminiModelName}:generateContent`;
        
        const contents = [{
          parts: [] as any[]
        }];

        if (base64Data && mimeType) {
          contents[0].parts.push({
            inlineData: { data: base64Data, mimeType }
          });
        }
        contents[0].parts.push({ text: prompt });

        const fetchResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ contents })
        });

        const geminiData = await fetchResponse.json();
        
        if (!fetchResponse.ok) {
          throw new Error(geminiData.error?.message || "Gemini Fallback API Error");
        }

        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return res.json({ text, isFallback: true });

      } catch (fallbackError: any) {
        console.error("[Fallback Failed]:", fallbackError);
        throw vertexError; 
      }
    }
  } catch (error: any) {
    console.error("[Vercel API Error]:", error);
    res.status(500).json({ 
      error: error.message || "Kesalahan internal pada API Vertex AI.",
      details: error.stack
    });
  }
}
