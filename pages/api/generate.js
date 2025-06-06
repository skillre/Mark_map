// 这个API端点将在server.js中处理
// 由于我们使用了自定义服务器，这个文件只是作为占位符

// 转发请求到我们的API处理程序
export default async function handler(req, res) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL || 'http://localhost:3000'}/api/generate`, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req.body),
  });

  const data = await response.json();
  res.status(response.status).json(data);
} 