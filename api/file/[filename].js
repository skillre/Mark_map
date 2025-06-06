// 在Vercel环境中，使用此文件处理文件访问的API请求
const app = require('../../server');

// 导出一个处理函数而不是Express应用
module.exports = async (req, res) => {
  // 手动将请求传递给Express应用
  await app(req, res);
}; 