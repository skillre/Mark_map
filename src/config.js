const path = require('path');

// 环境配置
const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION;
const PORT = process.env.PORT || 3000;

// API密钥配置
const API_KEYS = (process.env.API_KEYS || 'dev-key,test-key').split(',');
const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT || '100'); // 每个API密钥每小时请求限制

// 路径配置
const baseDir = isVercel ? '/tmp' : path.join(__dirname, '..');
const uploadDir = path.join(baseDir, 'uploads');
const outputDir = path.join(baseDir, 'output');
const publicDir = path.join(__dirname, '../public');

// 大小限制配置
const MAX_MARKDOWN_SIZE = 500000; // 约500KB限制
const MAX_NODES = 500; // 最大节点数
const MAX_FILE_SIZE = 1024 * 1024; // 1MB上传文件大小限制

module.exports = {
  isVercel,
  PORT,
  API_KEYS,
  API_RATE_LIMIT,
  baseDir,
  uploadDir,
  outputDir,
  publicDir,
  MAX_MARKDOWN_SIZE,
  MAX_NODES,
  MAX_FILE_SIZE
}; 