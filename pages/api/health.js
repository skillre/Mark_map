/**
 * 健康检查API
 * @param {import('next').NextApiRequest} req 
 * @param {import('next').NextApiResponse} res 
 */
export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    version: '1.0.0',
    time: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'local'
  });
} 