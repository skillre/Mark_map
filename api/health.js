// 在Vercel环境中，使用此文件处理健康检查API请求
const app = require('./express-server');

// 导出一个处理函数而不是Express应用
module.exports = async (req, res) => {
  // 手动将请求传递给Express应用的健康检查路由处理程序
  console.log('API路由: /api/health');
  req.url = '/health';
  await app(req, res);
}; 