const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const crypto = require('crypto');

// 引入markmap库，用于直接生成SVG
const { Transformer } = require('markmap-lib');
const { fillTemplate } = require('markmap-common');
const transformer = new Transformer();

const app = express();
const PORT = process.env.PORT || 3000;

// API密钥配置
const API_KEYS = (process.env.API_KEYS || 'dev-key,test-key').split(',');
const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT || '100'); // 每个API密钥每小时请求限制
const apiRateLimits = {}; // 用于跟踪API使用情况

// 在Vercel环境中使用/tmp目录
const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION;
const baseDir = isVercel ? '/tmp' : path.join(__dirname, '..');
const uploadDir = path.join(baseDir, 'uploads');
const outputDir = path.join(baseDir, 'output');

// 确保目录存在
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 配置存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

// 中间件
app.use(cors());
app.use(express.json({ limit: '1mb' })); // 限制JSON大小
app.use(express.urlencoded({ extended: true, limit: '1mb' })); // 限制表单大小
app.use(express.static(path.join(__dirname, '../public')));
app.use('/output', express.static(outputDir));

// API密钥验证中间件
function validateApiKey(req, res, next) {
  // 跳过Web界面的验证
  if (req.path === '/' || req.path.startsWith('/output/') || req.path === '/api-docs') {
    return next();
  }
  
  // 从请求中获取API密钥
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  // 验证API密钥
  if (!apiKey || !API_KEYS.includes(apiKey)) {
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
  if (apiRateLimits[apiKey].length >= API_RATE_LIMIT) {
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

// 应用API密钥验证中间件
app.use(validateApiKey);

// 添加基本错误处理中间件
app.use((err, req, res, next) => {
  console.error('应用错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器错误',
    message: err.message
  });
});

/**
 * 从 Markdown 生成思维导图 HTML
 * @param {string} markdownContent Markdown 内容
 * @param {string} outputFilename 输出文件名
 * @returns {Promise<string>} HTML 文件路径
 */
async function generateMarkmap(markdownContent, outputFilename) {
  console.log('generateMarkmap: 开始生成思维导图HTML');
  const htmlOutputPath = path.join(outputDir, `${outputFilename}.html`);
  
  // 限制过大的文件，防止内存溢出
  if (markdownContent.length > 500000) { // 约500KB限制
    throw new Error('Markdown文件过大，请减小文件大小');
  }
  
  try {
    // 确保生成输出目录存在
    if (!fs.existsSync(outputDir)) {
      console.log(`创建输出目录: ${outputDir}`);
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log('创建基本的思维导图HTML');
    
    // 使用最简单的在线方式生成思维导图，不尝试在服务端解析
    const markmapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>思维导图</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@6.7.0"></script>
  <script src="https://cdn.jsdelivr.net/npm/markmap-view@0.14.0"></script>
  <script src="https://cdn.jsdelivr.net/npm/markmap-lib@0.14.0/dist/browser/index.js"></script>
  <style>
    html, body, svg { height: 100%; width: 100%; margin: 0; padding: 0; }
    .loading { font-family: sans-serif; font-size: 16px; padding: 20px; }
    .error { color: red; padding: 20px; font-family: sans-serif; font-size: 16px; }
  </style>
</head>
<body>
  <div id="loading" class="loading">正在加载思维导图...</div>
  <div id="error" class="error" style="display:none;"></div>
  <svg id="mindmap" style="display:none;"></svg>
  <script>
  document.addEventListener('DOMContentLoaded', function() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const svgEl = document.getElementById('mindmap');
    
    try {
      // 原始Markdown内容
      const markdown = ${JSON.stringify(markdownContent)};
      
      if (!window.markmap || !window.markmap.Transformer) {
        throw new Error('思维导图库加载失败');
      }
      
      // 使用markmap-lib转换Markdown
      const transformer = new window.markmap.Transformer();
      const { root } = transformer.transform(markdown);
      
      // 渲染思维导图
      const mm = window.markmap.Markmap.create(svgEl, {
        autoFit: true, 
        zoom: true
      }, root);
      
      // 显示思维导图
      loadingEl.style.display = 'none';
      svgEl.style.display = 'block';
    } catch (error) {
      console.error('思维导图渲染失败:', error);
      loadingEl.style.display = 'none';
      errorEl.textContent = '思维导图渲染失败: ' + (error.message || '未知错误');
      errorEl.style.display = 'block';
    }
  });
  </script>
</body>
</html>`;
    
    // 写入HTML文件
    console.log(`写入HTML文件: ${htmlOutputPath}`);
    fs.writeFileSync(htmlOutputPath, markmapHtml);
    
    // 检查文件是否成功生成
    if (!fs.existsSync(htmlOutputPath)) {
      throw new Error('未能创建HTML文件');
    }
    
    console.log('generateMarkmap: HTML生成完成');
    return htmlOutputPath;
  } catch (error) {
    console.error('生成HTML失败详细日志:', error);
    throw new Error(`生成思维导图HTML失败: ${error.message}`);
  }
}

/**
 * 直接从Markdown生成SVG思维导图
 * @param {string} markdownContent Markdown内容
 * @param {string} outputFilename 输出文件名
 * @returns {Promise<string>} SVG文件路径
 */
async function generateSvgMarkmap(markdownContent, outputFilename) {
  console.log(`generateSvgMarkmap: 开始生成SVG: ${outputFilename}`);
  const svgOutputPath = path.join(outputDir, `${outputFilename}.svg`);
  
  try {
    // 确保生成输出目录存在
    if (!fs.existsSync(outputDir)) {
      console.log(`创建输出目录: ${outputDir}`);
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 使用markmap-lib将Markdown转换为思维导图数据
    const { root, features } = transformer.transform(markdownContent);
    
    // 生成SVG字符串
    const assets = {
      styles: '',
      scripts: ''
    };
    
    // 基本SVG模板，包含必要的样式和JavaScript
    const svgTemplate = `
<svg xmlns="http://www.w3.org/2000/svg" class="markmap" width="800" height="800" style="background-color: white;">
  <style>
    .markmap-node {
      cursor: pointer;
    }
    .markmap-node-circle {
      fill: #fff;
      stroke-width: 1.5px;
    }
    .markmap-node-text {
      fill: #000;
      font: 10px sans-serif;
    }
    .markmap-link {
      fill: none;
    }
  </style>
  <g transform="translate(400, 400)">
    <text x="0" y="0" text-anchor="middle" style="font-family: Arial; font-size: 20px; fill: #333;">
      思维导图静态预览
    </text>
    <text x="0" y="30" text-anchor="middle" style="font-family: Arial; font-size: 16px; fill: #666;">
      请使用HTML版本获取完整交互体验
    </text>
    <g transform="translate(0, 70)">
      <text x="0" y="0" text-anchor="middle" style="font-family: Arial; font-size: 14px; fill: #333; font-weight: bold;">
        ${root.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </text>
      ${root.children.map((child, i) => `
        <line x1="0" y1="10" x2="${-100 + i * 200/(root.children.length || 1)}" y2="${40}" 
              style="stroke: #999; stroke-width: 1px;"></line>
        <text x="${-100 + i * 200/(root.children.length || 1)}" y="${50}" 
              text-anchor="middle" style="font-family: Arial; font-size: 12px; fill: #666;">
          ${child.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </text>
      `).join('')}
    </g>
  </g>
  <text x="400" y="750" text-anchor="middle" style="font-family: Arial; font-size: 14px; fill: #999;">
    这是静态SVG预览，请使用HTML版本获取完整的交互式思维导图
  </text>
</svg>`;

    // 写入SVG文件
    console.log(`写入SVG文件: ${svgOutputPath}`);
    fs.writeFileSync(svgOutputPath, svgTemplate);
    
    console.log('generateSvgMarkmap: SVG生成完成');
    return svgOutputPath;
  } catch (error) {
    console.error('生成SVG失败详细日志:', error);
    throw new Error(`生成SVG思维导图失败: ${error.message}`);
  }
}

/**
 * 生成简单的 XMind 兼容格式
 * @param {string} markdownContent Markdown 内容
 * @param {string} outputFilename 输出文件名
 * @returns {Promise<string>} XMind 文件路径
 */
async function generateXMindFile(markdownContent, outputFilename) {
  const xmindOutputPath = path.join(outputDir, `${outputFilename}.json`);
  
  // 只处理标题行，减少内存占用
  const lines = markdownContent
    .split('\n')
    .filter(line => line.trim().startsWith('#'))
    .slice(0, 500); // 限制最大节点数
  
  // 使用流式处理构造JSON
  const rootNode = { title: "思维导图", children: [] };
  const stack = [{ level: 0, node: rootNode }];
  
  for (const line of lines) {
    // 计算标题级别（#的数量）
    const match = line.match(/^(#+)\s+(.+)$/);
    if (!match) continue;
    
    const level = match[1].length;
    const title = match[2].trim().substring(0, 100); // 限制标题长度
    const newNode = { title, children: [] };
    
    // 找到正确的父节点
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    
    const parent = stack[stack.length - 1].node;
    parent.children.push(newNode);
    
    stack.push({ level, node: newNode });
  }
  
  // 写入 JSON 文件（简化的 XMind 兼容格式）
  fs.writeFileSync(xmindOutputPath, JSON.stringify(rootNode));
  
  return xmindOutputPath;
}

// 路由处理
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 确保API文档路由正确响应
app.get('/api-docs', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/api-docs.html'));
});

// 定期清理临时文件，防止存储空间占满
function cleanupTempFiles() {
  try {
    // 获取当前时间戳和24小时前的时间戳
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // 清理24小时前的输出文件
    if (fs.existsSync(outputDir)) {
      fs.readdirSync(outputDir).forEach(file => {
        const filePath = path.join(outputDir, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < oneDayAgo) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            // 忽略删除错误
          }
        }
      });
    }

    // 清理上传目录
    if (fs.existsSync(uploadDir)) {
      fs.readdirSync(uploadDir).forEach(file => {
        try {
          fs.unlinkSync(path.join(uploadDir, file));
        } catch (e) {
          // 忽略删除错误
        }
      });
    }
  } catch (err) {
    console.error('清理文件错误:', err);
  }
}

// 每小时运行一次清理
setInterval(cleanupTempFiles, 60 * 60 * 1000);

// 提供SVG图片
app.get('/api/image/:filename', async (req, res) => {
  try {
    // 详细记录请求信息
    console.log(`图片API被调用: ${req.params.filename}`);
    console.log(`请求完整URL: ${req.originalUrl}`);
    
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
      path.join(outputDir, `${filename}.svg`),          // 优先尝试SVG
      path.join(outputDir, `${rawFilename}`),           // 原始文件名
      path.join(outputDir, `${filename.split('-')[0]}-${filename.split('-')[1]}.svg`) // 移除后缀后尝试
    ];
    
    console.log('尝试查找以下文件:');
    for (const p of possiblePaths) {
      console.log(` - ${p} (存在: ${fs.existsSync(p)})`);
    }
    
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
      path.join(uploadDir, `${filename}.md`),
      path.join(uploadDir, `${rawFilename}.md`),
      path.join(uploadDir, `${filename.split('-')[0]}-${filename.split('-')[1]}.md`)
    ];
    
    console.log('尝试查找markdown源文件:');
    for (const p of markdownPaths) {
      console.log(` - ${p} (存在: ${fs.existsSync(p)})`);
    }
    
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
        const svgOutputPath = await generateSvgMarkmap(markdownContent, filename);
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
    const inlineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <rect width="100%" height="100%" fill="#f8f9fa"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="#666" text-anchor="middle">
        思维导图图片不可用
      </text>
      <text x="50%" y="50%" dy="30" font-family="Arial, sans-serif" font-size="18" fill="#999" text-anchor="middle">
        请使用HTML版本查看
      </text>
    </svg>`;
    
    res.type('image/svg+xml').send(inlineSvg);
    
  } catch (error) {
    console.error('图片生成失败详细信息:', error);
    // 发送内联SVG响应，即使在错误情况下也能显示
    const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <rect width="100%" height="100%" fill="#fee"/>
      <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="24" fill="#c00" text-anchor="middle">
        图片生成失败
      </text>
      <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="18" fill="#666" text-anchor="middle">
        ${error.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </text>
    </svg>`;
    
    res.type('image/svg+xml').send(errorSvg);
  }
});

// 标准化API接口 - 从文本生成思维导图
app.post('/api/v1/generate', async (req, res) => {
  try {
    const { markdown, title } = req.body;
    
    if (!markdown) {
      return res.status(400).json({
        success: false,
        error: 'Missing markdown content',
        message: '缺少Markdown文本'
      });
    }
    
    console.log('开始生成思维导图...');
    const timestamp = Date.now();
    // 生成唯一ID，避免冲突
    const uniqueId = crypto.randomBytes(4).toString('hex');
    const outputFilename = `markmap-${timestamp}-${uniqueId}`;
    
    try {
      // 保存markdown源文件，方便后续生成SVG
      const markdownPath = path.join(uploadDir, `${outputFilename}.md`);
      fs.writeFileSync(markdownPath, markdown);

      // 生成思维导图 HTML
      const htmlPath = await generateMarkmap(markdown, outputFilename);
      console.log(`HTML生成成功: ${htmlPath}`);
      
      // 生成SVG版本
      try {
        const svgPath = await generateSvgMarkmap(markdown, outputFilename);
        console.log(`SVG生成成功: ${svgPath}`);
      } catch (svgError) {
        console.error('SVG生成失败:', svgError);
      }
      
      // 生成思维导图文件 (XMind 格式)
      const xmindPath = await generateXMindFile(markdown, outputFilename);
      console.log(`XMind文件生成成功: ${xmindPath}`);
      
      // 构建基础URL
      const baseUrl = req.protocol + '://' + req.get('host');
      
      // 返回标准化的API响应
      res.json({
        success: true,
        data: {
          id: outputFilename,
          title: title || '思维导图',
          created_at: new Date().toISOString(),
          links: {
            html: `${baseUrl}/output/${outputFilename}.html`,
            svg: `${baseUrl}/api/image/${outputFilename}.svg`,
            mindmap: `${baseUrl}/output/${outputFilename}.json`
          },
          urls: {
            html_url: `${baseUrl}/output/${outputFilename}.html`,
            svg_url: `${baseUrl}/api/image/${outputFilename}.svg`,
            mindmap_url: `${baseUrl}/output/${outputFilename}.json`
          }
        }
      });
    } catch (processingError) {
      console.error('处理错误详情:', processingError);
      throw new Error(`生成失败: ${processingError.message}`);
    }
  } catch (error) {
    console.error('生成失败详细信息:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate mindmap',
      message: error.message
    });
  }
});

// 标准化API接口 - 文件上传
app.post('/api/v1/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: '缺少文件'
      });
    }
    
    const timestamp = Date.now();
    // 生成唯一ID，避免冲突
    const uniqueId = crypto.randomBytes(4).toString('hex');
    const outputFilename = `markmap-${timestamp}-${uniqueId}`;
    
    // 读取上传的 Markdown 文件
    const markdown = fs.readFileSync(req.file.path, 'utf-8');
    
    // 保存markdown源文件，方便后续生成SVG
    const markdownPath = path.join(uploadDir, `${outputFilename}.md`);
    fs.writeFileSync(markdownPath, markdown);
    
    // 生成思维导图 HTML
    const htmlPath = await generateMarkmap(markdown, outputFilename);
    
    // 生成SVG版本
    try {
      const svgPath = await generateSvgMarkmap(markdown, outputFilename);
      console.log(`SVG生成成功: ${svgPath}`);
    } catch (svgError) {
      console.error('SVG生成失败:', svgError);
    }
    
    // 生成思维导图文件 (XMind 格式)
    const xmindPath = await generateXMindFile(markdown, outputFilename);
    
    // 构建基础URL
    const baseUrl = req.protocol + '://' + req.get('host');
    
    // 返回标准化的API响应
    res.json({
      success: true,
      data: {
        id: outputFilename,
        title: req.file.originalname || '思维导图',
        created_at: new Date().toISOString(),
        links: {
          html: `${baseUrl}/output/${outputFilename}.html`,
          svg: `${baseUrl}/api/image/${outputFilename}.svg`,
          mindmap: `${baseUrl}/output/${outputFilename}.json`
        },
        urls: {
          html_url: `${baseUrl}/output/${outputFilename}.html`,
          svg_url: `${baseUrl}/api/image/${outputFilename}.svg`,
          mindmap_url: `${baseUrl}/output/${outputFilename}.json`
        }
      }
    });
  } catch (error) {
    console.error('生成失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate mindmap',
      message: error.message
    });
  }
});

// 兼容旧版API - 从文本生成思维导图
app.post('/api/generate', async (req, res) => {
  try {
    const { markdown } = req.body;
    
    if (!markdown) {
      return res.status(400).json({ error: '缺少 Markdown 文本' });
    }
    
    console.log('开始生成思维导图...');
    const timestamp = Date.now();
    // 添加随机后缀，避免冲突
    const uniqueId = crypto.randomBytes(2).toString('hex');
    const outputFilename = `markmap-${timestamp}-${uniqueId}`;
    
    try {
      // 保存markdown源文件，方便后续生成SVG
      const markdownPath = path.join(uploadDir, `${outputFilename}.md`);
      fs.writeFileSync(markdownPath, markdown);

      // 生成思维导图 HTML
      const htmlPath = await generateMarkmap(markdown, outputFilename);
      console.log(`HTML生成成功: ${htmlPath}`);
      
      // 生成SVG版本
      try {
        const svgPath = await generateSvgMarkmap(markdown, outputFilename);
        console.log(`SVG生成成功: ${svgPath}`);
      } catch (svgError) {
        console.error('SVG生成失败:', svgError);
      }
      
      // 生成思维导图文件 (XMind 格式)
      const xmindPath = await generateXMindFile(markdown, outputFilename);
      console.log(`XMind文件生成成功: ${xmindPath}`);
      
      // 返回文件路径
      res.json({
        html: `/output/${outputFilename}.html`,
        image: `/api/image/${outputFilename}.svg`,
        mindmap: `/output/${outputFilename}.json`
      });
    } catch (processingError) {
      console.error('处理错误详情:', processingError);
      throw new Error(`生成失败: ${processingError.message}`);
    }
  } catch (error) {
    console.error('生成失败详细信息:', error);
    res.status(500).json({ error: '生成思维导图失败', details: error.message });
  }
});

// 兼容旧版API - 文件上传
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '缺少文件' });
    }
    
    const timestamp = Date.now();
    // 添加随机后缀，避免冲突
    const uniqueId = crypto.randomBytes(2).toString('hex');
    const outputFilename = `markmap-${timestamp}-${uniqueId}`;
    
    // 读取上传的 Markdown 文件
    const markdown = fs.readFileSync(req.file.path, 'utf-8');
    
    // 保存markdown源文件，方便后续生成SVG
    const markdownPath = path.join(uploadDir, `${outputFilename}.md`);
    fs.writeFileSync(markdownPath, markdown);
    
    // 生成思维导图 HTML
    const htmlPath = await generateMarkmap(markdown, outputFilename);
    
    // 生成SVG版本
    try {
      const svgPath = await generateSvgMarkmap(markdown, outputFilename);
      console.log(`SVG生成成功: ${svgPath}`);
    } catch (svgError) {
      console.error('SVG生成失败:', svgError);
    }
    
    // 生成思维导图文件 (XMind 格式)
    const xmindPath = await generateXMindFile(markdown, outputFilename);
    
    // 返回文件路径
    res.json({
      html: `/output/${outputFilename}.html`,
      image: `/api/image/${outputFilename}.svg`,
      mindmap: `/output/${outputFilename}.json`
    });
  } catch (error) {
    console.error('生成失败:', error);
    res.status(500).json({ error: '生成思维导图失败', details: error.message });
  }
});

// 启动服务器（仅在直接运行时，非 Vercel 环境）
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_VERSION) {
  app.listen(PORT, () => {
    console.log(`服务已启动在 http://localhost:${PORT}`);
    console.log(`API文档: http://localhost:${PORT}/api-docs`);
  });
}

// 导出应用供 Vercel 使用
module.exports = app; 