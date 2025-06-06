// 在Vercel环境中，使用此文件处理文件上传的API请求
const app = require('../express-server');

// 导出一个处理函数而不是Express应用
module.exports = async (req, res) => {
  // 手动将请求传递给Express应用的upload路由处理程序
  console.log('API路由: /api/upload');
  req.url = '/upload';
  await app(req, res);
}; 