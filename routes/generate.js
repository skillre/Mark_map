const express = require('express');
const router = express.Router();
const { transform } = require('markmap-lib');

router.post('/', async (req, res) => {
  try {
    // 简化初始版本
    const { markdown } = req.body;
    const { root } = transform(markdown || '# 默认标题');
    
    res.json({
      status: 'success',
      svg: `<svg>${root.children.map(c => c.text).join('')}</svg>`
    });
    
  } catch (error) {
    console.error('生成错误:', error);
    res.status(500).json({
      error: '处理失败',
      message: error.message
    });
  }
}); 