// 这个文件作为Vercel无服务器函数的入口点
try {
  // 导出src/index.js中的Express应用
  const app = require('../src/index.js');
  module.exports = app;
} catch (error) {
  console.error('API加载错误:', error);
  // 提供一个简单的错误处理函数，以防主应用加载失败
  module.exports = (req, res) => {
    res.status(500).json({ error: '服务初始化失败', details: error.message });
  };
} 