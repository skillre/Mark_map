const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

/**
 * 确保目录存在，如果不存在则创建
 * @param {string} dirPath 目录路径 
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 生成唯一文件名
 * @param {string} prefix 文件名前缀
 * @param {number} randomBytesLength 随机字节长度
 * @returns {string} 唯一文件名
 */
function generateUniqueFilename(prefix = 'markmap', randomBytesLength = 4) {
  const timestamp = Date.now();
  const uniqueId = crypto.randomBytes(randomBytesLength).toString('hex');
  return `${prefix}-${timestamp}-${uniqueId}`;
}

/**
 * 清理临时文件
 * @param {number} maxAgeDays 最大保留天数
 */
function cleanupTempFiles(maxAgeDays = 1) {
  try {
    // 获取当前时间戳和指定天数前的时间戳
    const now = Date.now();
    const cutoffTime = now - maxAgeDays * 24 * 60 * 60 * 1000;

    // 清理老旧的输出文件
    if (fs.existsSync(config.outputDir)) {
      fs.readdirSync(config.outputDir).forEach(file => {
        const filePath = path.join(config.outputDir, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < cutoffTime) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            // 忽略删除错误
          }
        }
      });
    }

    // 清理上传目录
    if (fs.existsSync(config.uploadDir)) {
      fs.readdirSync(config.uploadDir).forEach(file => {
        try {
          const filePath = path.join(config.uploadDir, file);
          const stats = fs.statSync(filePath);
          if (stats.mtimeMs < cutoffTime) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {
          // 忽略删除错误
        }
      });
    }
  } catch (err) {
    console.error('清理文件错误:', err);
  }
}

// 初始化目录
ensureDirectoryExists(config.uploadDir);
ensureDirectoryExists(config.outputDir);

module.exports = {
  ensureDirectoryExists,
  generateUniqueFilename,
  cleanupTempFiles
}; 