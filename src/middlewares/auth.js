const config = require('../config');

// 用于跟踪API使用情况
const apiRateLimits = {};

/**
 * API密钥验证中间件
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Function} next 下一个中间件
 */
function validateApiKey(req, res, next) {
  // 跳过Web界面的验证
  if (req.path === '/' || req.path.startsWith('/output/') || req.path === '/api-docs') {
    return next();
  }
  
  // 从请求中获取API密钥
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  // 验证API密钥
  if (!apiKey || !config.API_KEYS.includes(apiKey)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
      message: '无效的API密钥'
    });
  }
  
  // 检查API使用率限制
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  
  // 初始化该API密钥的使用记录
  if (!apiRateLimits[apiKey]) {
    apiRateLimits[apiKey] = [];
  }
  
  // 清除一小时前的记录
  apiRateLimits[apiKey] = apiRateLimits[apiKey].filter(timestamp => timestamp > hourAgo);
  
  // 检查是否超过限制
  if (apiRateLimits[apiKey].length >= config.API_RATE_LIMIT) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: 'API使用率超出限制，请稍后再试'
    });
  }
  
  // 记录本次使用
  apiRateLimits[apiKey].push(now);
  
  // 继续处理请求
  next();
}

/**
 * 错误处理中间件
 * @param {Error} err 错误对象
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Function} next 下一个中间件
 */
function errorHandler(err, req, res, next) {
  console.error('应用错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器错误',
    message: err.message
  });
}

module.exports = {
  validateApiKey,
  errorHandler
}; 