import { GoogleAuth } from 'google-auth-library';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { serviceAccount } = req.body;
    if (!serviceAccount) return res.status(400).json({ error: "Service Account JSON is required" });

    let sa: any;
    try {
      sa = typeof serviceAccount === 'string' ? JSON.parse(serviceAccount) : serviceAccount;
    } catch (e) {
      return res.status(400).json({ error: "Format JSON tidak valid." });
    }

    if (sa.private_key && typeof sa.private_key === 'string' && sa.private_key.includes('\\n')) {
      sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    }

    const auth = new GoogleAuth({
      credentials: sa,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();

    res.json({ 
      token: tokenResponse.token,
      projectId: sa.project_id || sa.project,
      expiresAt: tokenResponse.res?.data?.expiry_date || null,
      message: "Token berhasil dibuat."
    });
  } catch (error: any) {
    console.error("[Token Error]:", error);
    res.status(500).json({ error: error.message || "Gagal membuat access token." });
  }
}
