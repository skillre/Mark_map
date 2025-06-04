const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const config = require('../config');
const fileUtils = require('../utils/fileUtils');
const markmapService = require('../services/markmapService');

// 配置存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, config.uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 1024 * 1024 } // 限制1MB
});

/**
 * GET /api/file/:filename - 获取JSON思维导图文件
 */
router.get('/file/:filename', async (req, res) => {
  try {
    // 获取文件名
    const filename = req.params.filename;
    
    // 安全检查，防止路径遍历攻击
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: '无效的文件名'
      });
    }
    
    // 构建完整的文件路径
    const filePath = path.join(config.outputDir, filename);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: '文件不存在',
        message: `找不到文件: ${filename}`
      });
    }
    
    // 读取文件内容
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // 设置响应头，指示这是一个JSON文件下载
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // 发送文件内容
    res.send(fileContent);
  } catch (error) {
    console.error('文件下载错误:', error);
    res.status(500).json({
      success: false,
      error: '文件下载失败',
      message: error.message
    });
  }
});

/**
 * GET /api/image/:filename - 获取思维导图SVG图像
 */
router.get('/image/:filename', async (req, res) => {
  try {
    // 详细记录请求信息
    console.log(`图片API被调用: ${req.params.filename}`);
    
    // 移除所有可能的文件扩展名
    const rawFilename = req.params.filename;
    const filename = rawFilename.replace(/\.(png|svg)$/, '');
    
    console.log(`原始文件名: ${rawFilename}, 处理后的文件名: ${filename}`);
    
    // 添加安全检查，防止路径遍历攻击
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: '无效的文件名'
      });
    }
    
    // 尝试多种可能的文件路径
    const possiblePaths = [
      path.join(config.outputDir, `${filename}.svg`),          // 优先尝试SVG
      path.join(config.outputDir, `${rawFilename}`),           // 原始文件名
      path.join(config.outputDir, `${filename.split('-')[0]}-${filename.split('-')[1]}.svg`) // 移除后缀后尝试
    ];
    
    // 尝试找到已存在的SVG文件
    let svgPath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        svgPath = p;
        console.log(`找到有效的SVG文件: ${svgPath}`);
        break;
      }
    }
    
    // 如果找到了SVG文件，直接返回
    if (svgPath) {
      return res.type('image/svg+xml').sendFile(svgPath);
    }
    
    // 检查是否有对应的markdown源文件，尝试直接生成SVG
    const markdownPaths = [
      path.join(config.uploadDir, `${filename}.md`),
      path.join(config.uploadDir, `${rawFilename}.md`),
      path.join(config.uploadDir, `${filename.split('-')[0]}-${filename.split('-')[1]}.md`)
    ];
    
    let markdownContent = null;
    for (const p of markdownPaths) {
      if (fs.existsSync(p)) {
        try {
          markdownContent = fs.readFileSync(p, 'utf-8');
          console.log(`找到并读取markdown文件: ${p}`);
          break;
        } catch (err) {
          console.error(`读取文件 ${p} 失败:`, err);
        }
      }
    }
    
    // 如果找到了markdown内容，尝试生成SVG
    if (markdownContent) {
      try {
        const svgOutputPath = await markmapService.generateSvgMarkmap(markdownContent, filename);
        console.log(`成功生成SVG: ${svgOutputPath}`);
        if (fs.existsSync(svgOutputPath)) {
          return res.type('image/svg+xml').sendFile(svgOutputPath);
        }
      } catch (svgError) {
        console.error('生成SVG失败:', svgError);
      }
    }
    
    // 生成内联SVG响应
    console.log('生成内联SVG响应');
    const inlineSvg = markmapService.generateInlineSvg('思维导图图片不可用');
    res.type('image/svg+xml').send(inlineSvg);
    
  } catch (error) {
    console.error('图片生成失败详细信息:', error);
    // 发送内联SVG响应，即使在错误情况下也能显示
    const errorSvg = markmapService.generateInlineSvg('图片生成失败: ' + error.message, true);
    res.type('image/svg+xml').send(errorSvg);
  }
});

/**
 * POST /api/v1/generate - 从文本生成思维导图
 */
router.post('/v1/generate', async (req, res) => {
  try {
    const markdown = req.body.markdown;
    
    if (!markdown) {
      return res.status(400).json({
        success: false,
        error: 'Missing markdown content',
        message: '缺少Markdown内容'
      });
    }
    
    // 生成唯一文件名
    const uniqueFilename = fileUtils.generateUniqueFilename();
    console.log(`API处理: 从文本生成思维导图，文件名: ${uniqueFilename}`);
    
    // 保存markdown源文件，方便后续生成SVG
    const markdownPath = path.join(config.uploadDir, `${uniqueFilename}.md`);
    fs.writeFileSync(markdownPath, markdown);
    
    // 并行生成所有输出格式
    const [htmlPath, svgPath, jsonPath] = await Promise.all([
      markmapService.generateMarkmap(markdown, uniqueFilename),
      markmapService.generateSvgMarkmap(markdown, uniqueFilename),
      markmapService.generateXMindFile(markdown, uniqueFilename)
    ]).catch(err => {
      console.error('生成思维导图时出错:', err);
      throw err;
    });
    
    // 构建基础URL
    const baseUrl = req.protocol + '://' + req.get('host');
    
    // 返回生成结果
    res.json({
      success: true,
      data: {
        id: uniqueFilename,
        title: req.body.title || '思维导图',
        created_at: new Date().toISOString(),
        links: {
          html: `/output/${path.basename(htmlPath)}`,
          svg: `/api/image/${uniqueFilename}.svg`,
          mindmap: `/api/file/${path.basename(jsonPath)}`
        },
        urls: {
          html_url: `${baseUrl}/output/${uniqueFilename}.html`,
          svg_url: `${baseUrl}/api/image/${uniqueFilename}.svg`,
          mindmap_url: `${baseUrl}/api/file/${uniqueFilename}.json`
        }
      }
    });
    
    // 异步清理老文件
    fileUtils.cleanupTempFiles();
  } catch (error) {
    console.error('从文本生成思维导图API错误:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate mindmap',
      message: `生成思维导图失败: ${error.message}`
    });
  }
});

/**
 * POST /api/v1/upload - 从上传的文件生成思维导图
 */
router.post('/v1/upload', upload.single('file'), async (req, res) => {
  try {
    // 检查是否有文件上传
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: '没有上传文件'
      });
    }
    
    // 检查文件类型
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    if (fileExt !== '.md' && fileExt !== '.markdown' && fileExt !== '.txt') {
      // 删除不支持的文件
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Unsupported file type',
        message: '不支持的文件类型，请上传.md、.markdown或.txt文件'
      });
    }
    
    // 读取上传的文件内容
    const markdown = fs.readFileSync(req.file.path, 'utf8');
    
    // 生成唯一文件名
    const uniqueFilename = fileUtils.generateUniqueFilename();
    console.log(`API处理: 从文件生成思维导图，文件名: ${uniqueFilename}`);
    
    // 保存markdown源文件，方便后续生成SVG
    const markdownPath = path.join(config.uploadDir, `${uniqueFilename}.md`);
    fs.writeFileSync(markdownPath, markdown);
    
    // 并行生成所有输出格式
    const [htmlPath, svgPath, jsonPath] = await Promise.all([
      markmapService.generateMarkmap(markdown, uniqueFilename),
      markmapService.generateSvgMarkmap(markdown, uniqueFilename),
      markmapService.generateXMindFile(markdown, uniqueFilename)
    ]).catch(err => {
      console.error('生成思维导图时出错:', err);
      throw err;
    });
    
    // 构建基础URL
    const baseUrl = req.protocol + '://' + req.get('host');
    
    // 返回生成结果
    res.json({
      success: true,
      data: {
        id: uniqueFilename,
        title: req.file.originalname || '思维导图',
        created_at: new Date().toISOString(),
        links: {
          html: `/output/${path.basename(htmlPath)}`,
          svg: `/api/image/${uniqueFilename}.svg`,
          mindmap: `/api/file/${path.basename(jsonPath)}`
        },
        urls: {
          html_url: `${baseUrl}/output/${uniqueFilename}.html`,
          svg_url: `${baseUrl}/api/image/${uniqueFilename}.svg`,
          mindmap_url: `${baseUrl}/api/file/${uniqueFilename}.json`
        }
      }
    });
    
    // 清理上传的文件
    fs.unlinkSync(req.file.path);
    
    // 异步清理老文件
    fileUtils.cleanupTempFiles();
  } catch (error) {
    console.error('从文件生成思维导图API错误:', error);
    
    // 清理上传的文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate mindmap',
      message: `生成思维导图失败: ${error.message}`
    });
  }
});

// 旧版API的兼容接口
router.post('/generate', async (req, res) => {
  try {
    const { markdown } = req.body;
    
    if (!markdown) {
      return res.status(400).json({
        success: false,
        error: 'Missing markdown content',
        message: '缺少Markdown内容'
      });
    }
    
    // 生成唯一文件名
    const uniqueFilename = fileUtils.generateUniqueFilename();
    
    // 保存markdown源文件，方便后续生成SVG
    const markdownPath = path.join(config.uploadDir, `${uniqueFilename}.md`);
    fs.writeFileSync(markdownPath, markdown);
    
    // 并行生成所有输出格式
    const [htmlPath, svgPath, jsonPath] = await Promise.all([
      markmapService.generateMarkmap(markdown, uniqueFilename),
      markmapService.generateSvgMarkmap(markdown, uniqueFilename),
      markmapService.generateXMindFile(markdown, uniqueFilename)
    ]).catch(err => {
      console.error('生成思维导图时出错:', err);
      throw err;
    });
    
    // 返回旧格式的响应
    res.json({
      html: `/output/${path.basename(htmlPath)}`,
      image: `/api/image/${uniqueFilename}.svg`,
      mindmap: `/api/file/${path.basename(jsonPath)}`
    });
    
    // 异步清理老文件
    fileUtils.cleanupTempFiles();
  } catch (error) {
    console.error('从文本生成思维导图API错误:', error);
    res.status(500).json({
      error: `生成思维导图失败: ${error.message}`
    });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    // 检查是否有文件上传
    if (!req.file) {
      return res.status(400).json({
        error: '没有上传文件'
      });
    }
    
    // 检查文件类型
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    if (fileExt !== '.md' && fileExt !== '.markdown' && fileExt !== '.txt') {
      // 删除不支持的文件
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: '不支持的文件类型，请上传.md、.markdown或.txt文件'
      });
    }
    
    // 读取上传的文件内容
    const markdown = fs.readFileSync(req.file.path, 'utf8');
    
    // 生成唯一文件名
    const uniqueFilename = fileUtils.generateUniqueFilename();
    
    // 保存markdown源文件，方便后续生成SVG
    const markdownPath = path.join(config.uploadDir, `${uniqueFilename}.md`);
    fs.writeFileSync(markdownPath, markdown);
    
    // 并行生成所有输出格式
    const [htmlPath, svgPath, jsonPath] = await Promise.all([
      markmapService.generateMarkmap(markdown, uniqueFilename),
      markmapService.generateSvgMarkmap(markdown, uniqueFilename),
      markmapService.generateXMindFile(markdown, uniqueFilename)
    ]).catch(err => {
      console.error('生成思维导图时出错:', err);
      throw err;
    });
    
    // 返回旧格式的响应
    res.json({
      html: `/output/${path.basename(htmlPath)}`,
      image: `/api/image/${uniqueFilename}.svg`,
      mindmap: `/api/file/${path.basename(jsonPath)}`
    });
    
    // 清理上传的文件
    fs.unlinkSync(req.file.path);
    
    // 异步清理老文件
    fileUtils.cleanupTempFiles();
  } catch (error) {
    console.error('从文件生成思维导图API错误:', error);
    
    // 清理上传的文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: `生成思维导图失败: ${error.message}`
    });
  }
});

module.exports = router; 