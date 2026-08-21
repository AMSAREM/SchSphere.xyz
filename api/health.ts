export default function handler(req: { method?: string }, res: { status: (code: number) => { json: (data: any) => void } }) {
  res.status(200).json({
    status: 'ok',
    platform: 'Vercel Serverless Function',
    service: 'SchoolSphere API',
    timestamp: new Date().toISOString()
  });
}
