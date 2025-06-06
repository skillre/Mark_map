// 这个API端点将在server.js中处理
// 由于我们使用了自定义服务器，这个文件只是作为占位符

// 转发请求到我们的API处理程序
export default async function handler(req, res) {
  try {
    // 确保URL包含协议前缀
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL || 'localhost:3000';
    const fullUrl = `https://${baseUrl.replace(/^https?:\/\//, '')}/api/generate`;
    
    console.log('转发请求到:', fullUrl);
    
    const response = await fetch(fullUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('API转发错误:', error);
    res.status(500).json({ 
      error: '服务器内部错误', 
      message: error.message,
      cause: error.cause?.message
    });
  }
} 