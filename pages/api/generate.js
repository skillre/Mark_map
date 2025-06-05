// 这个API端点将在server.js中处理
// 由于我们使用了自定义服务器，这个文件只是作为占位符

export default function handler(req, res) {
  res.status(404).json({ error: '请通过主服务器API访问' });
} 