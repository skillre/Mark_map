const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const markmapService = require('../services/markmapService');
const { validateApiKey } = require('../middlewares/auth');
const config = require('../config');

// 配置文件上传
const upload = multer({
  limits: {
    fileSize: config.MAX_FILE_SIZE,
    files: 1
  }
});

// 中间件验证API密钥
router.use(validateApiKey);

// API健康检查
router.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'API服务正常', version: '1.0' });
});

// 将Markdown转换为思维导图
router.post('/convert', upload.single('markdown_file'), async (req, res) => {
  console.log('收到转换请求');
  
  try {
    let markdownContent = '';
    let filename = 'markmap-' + Date.now();

    // 获取Markdown内容（从文件或文本输入）
    if (req.file) {
      console.log('从上传的文件中获取Markdown');
      markdownContent = req.file.buffer.toString('utf8');
      filename = path.parse(req.file.originalname).name + '-' + Date.now();
    } else if (req.body && req.body.markdown_text) {
      console.log('从文本输入中获取Markdown');
      markdownContent = req.body.markdown_text;
    } else {
      throw new Error('未提供Markdown内容');
    }

    // 检查Markdown内容大小
    if (markdownContent.length > config.MAX_MARKDOWN_SIZE) {
      throw new Error(`Markdown内容过大，请减小内容(最大${config.MAX_MARKDOWN_SIZE / 1000}KB)`);
    }

    // 生成思维导图HTML
    console.log('开始生成思维导图HTML');
    const htmlPath = await markmapService.generateMarkmap(markdownContent, filename);
    const htmlFilename = path.basename(htmlPath);

    console.log(`思维导图HTML处理完成: ${htmlFilename}`);

    // 返回结果
    res.json({
      success: true,
      message: '思维导图生成成功',
      html_url: `/output/${htmlFilename}`
    });
  } catch (error) {
    console.error('转换失败:', error);
    const statusCode = error.message.includes('过大') ? 413 : 500;
    res.status(statusCode).json({
      success: false,
      message: `转换失败: ${error.message}`,
      error: error.message
    });
  }
});

module.exports = router; 