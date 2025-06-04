const fs = require('fs');
const path = require('path');
const config = require('../../src/config');

// 处理输出文件请求
module.exports = (req, res) => {
  try {
    // 从URL中获取请求的文件名
    const { filename } = req.query;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: '缺少文件名参数',
        message: '请提供有效的文件名'
      });
    }
    
    // 构建文件路径
    const filePath = path.join(config.outputDir, filename);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.error(`文件不存在: ${filePath}`);
      return res.status(404).json({
        success: false,
        error: '文件未找到',
        message: '请求的思维导图文件不存在'
      });
    }
    
    // 读取文件内容
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // 设置内容类型
    res.setHeader('Content-Type', 'text/html');
    
    // 返回文件内容
    res.status(200).send(fileContent);
  } catch (error) {
    console.error('处理输出文件请求时出错:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: `访问文件失败: ${error.message}`
    });
  }
}; 