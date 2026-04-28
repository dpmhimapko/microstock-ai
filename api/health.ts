export default function handler(req: any, res: any) {
  res.status(200).json({ 
    status: "ok", 
    message: "Express server is alive and healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
}
