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
 * 强制重建目录（包含权限修复）
 * @param {string} dirPath 目录路径
 */
function forceCreateDirectory(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
    console.log(`重建目录成功: ${dirPath}`);
  } catch (error) {
    console.error(`目录重建失败: ${dirPath}`, error);
    throw new Error(`无法创建目录: ${error.message}`);
  }
}

/**
 * 生成唯一文件名
 * @param {string} prefix 文件名前缀
 * @returns {string} 唯一文件名
 */
function generateUniqueFilename(prefix = 'markmap') {
  const timestamp = Date.now();
  const uniqueId = crypto.randomBytes(4).toString('hex');
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
    cleanupDirectory(config.outputDir, cutoffTime);
    
    // 清理上传目录
    cleanupDirectory(config.uploadDir, cutoffTime);
  } catch (err) {
    console.error('清理文件错误:', err);
  }
}

/**
 * 清理指定目录中过期的文件
 * @param {string} directory 目录路径
 * @param {number} cutoffTime 截止时间戳
 */
function cleanupDirectory(directory, cutoffTime) {
  if (fs.existsSync(directory)) {
    fs.readdirSync(directory).forEach(file => {
      try {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filePath);
          console.log(`已删除过期文件: ${filePath}`);
        }
      } catch (e) {
        // 忽略删除错误
      }
    });
  }
}

// 初始化目录
ensureDirectoryExists(config.uploadDir);
ensureDirectoryExists(config.outputDir);

module.exports = {
  ensureDirectoryExists,
  forceCreateDirectory,
  generateUniqueFilename,
  cleanupTempFiles
};