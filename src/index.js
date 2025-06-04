const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// 配置 puppeteer 以在 Vercel 上运行
let puppeteer;
try {
  // 尝试导入针对 Vercel 环境优化的 puppeteer
  puppeteer = require('puppeteer-core');
} catch (e) {
  // 本地开发环境使用标准 puppeteer
  puppeteer = require('puppeteer');
}

const app = express();
const PORT = process.env.PORT || 3000;

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/output', express.static(outputDir));

/**
 * 从 Markdown 生成思维导图 HTML
 * @param {string} markdownContent Markdown 内容
 * @param {string} outputPath 输出路径
 * @returns {Promise<string>} HTML 文件路径
 */
async function generateMarkmap(markdownContent, outputFilename) {
  const mdFilePath = path.join(uploadDir, `${outputFilename}.md`);
  const htmlOutputPath = path.join(outputDir, `${outputFilename}.html`);
  
  // 写入 markdown 文件
  fs.writeFileSync(mdFilePath, markdownContent);
  
  // 使用 markmap-cli 生成 HTML
  const command = `npx markmap-cli ${mdFilePath} -o ${htmlOutputPath}`;
  await execPromise(command);
  
  return htmlOutputPath;
}

/**
 * 从 HTML 生成图片
 * @param {string} htmlPath HTML 文件路径
 * @param {string} outputFilename 输出文件名
 * @returns {Promise<string>} 图片文件路径
 */
async function generateImage(htmlPath, outputFilename) {
  const imageOutputPath = path.join(outputDir, `${outputFilename}.png`);
  
  // 获取 Chrome 可执行文件路径和浏览器选项
  let options = {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true, // 使用旧的headless模式，而不是"new"
  };
  
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    // Vercel环境
    const chromium = require('chrome-aws-lambda');
    options = {
      ...options,
      executablePath: await chromium.executablePath,
      args: [...chromium.args, ...options.args],
    };
  }

  // 启动浏览器
  const browser = await puppeteer.launch(options);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    // 加载 HTML 文件
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
    
    // 获取 SVG 元素的尺寸
    const svgDimensions = await page.evaluate(() => {
      const svg = document.querySelector('svg');
      if (!svg) return { width: 1200, height: 800 };
      
      // 获取 SVG 的边界框
      const bbox = svg.getBBox();
      return {
        width: Math.ceil(bbox.width + bbox.x * 2),
        height: Math.ceil(bbox.height + bbox.y * 2)
      };
    });
    
    // 调整视窗大小以匹配 SVG 尺寸
    await page.setViewport({
      width: svgDimensions.width,
      height: svgDimensions.height
    });
    
    // 截图
    await page.screenshot({ path: imageOutputPath });
    
    return imageOutputPath;
  } finally {
    await browser.close();
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
  
  // 使用简单的解析将 Markdown 转换为树形结构
  const lines = markdownContent.split('\n').filter(line => line.trim().startsWith('#'));
  const rootNode = { title: "思维导图", children: [] };
  
  // 当前节点堆栈
  const stack = [{ level: 0, node: rootNode }];
  
  lines.forEach(line => {
    // 计算标题级别（#的数量）
    const match = line.match(/^(#+)\s+(.+)$/);
    if (!match) return;
    
    const level = match[1].length;
    const title = match[2].trim();
    const newNode = { title, children: [] };
    
    // 找到正确的父节点
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    
    const parent = stack[stack.length - 1].node;
    parent.children.push(newNode);
    
    stack.push({ level, node: newNode });
  });
  
  // 写入 JSON 文件（简化的 XMind 兼容格式）
  fs.writeFileSync(xmindOutputPath, JSON.stringify(rootNode, null, 2));
  
  return xmindOutputPath;
}

// 路由处理
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 新增API端点 - 从HTML生成图片
app.get('/api/image/:filename', async (req, res) => {
  try {
    const filename = req.params.filename.replace(/\.png$/, '');
    const htmlPath = path.join(outputDir, `${filename}.html`);
    
    // 检查HTML文件是否存在
    if (!fs.existsSync(htmlPath)) {
      return res.status(404).json({ error: '找不到HTML文件' });
    }
    
    // 生成图片
    const imageOutputPath = path.join(outputDir, `${filename}.png`);
    
    // 检查图片是否已经存在
    if (fs.existsSync(imageOutputPath)) {
      // 图片已存在，直接发送
      return res.type('image/png').sendFile(imageOutputPath);
    }
    
    // 生成图片
    await generateImage(htmlPath, filename);
    
    // 发送图片
    if (fs.existsSync(imageOutputPath)) {
      return res.type('image/png').sendFile(imageOutputPath);
    } else {
      throw new Error('生成图片失败');
    }
  } catch (error) {
    console.error('图片生成失败:', error);
    res.status(500).json({ error: '生成图片失败', details: error.message });
  }
});

// 修改文本生成API，不再同步生成图片
app.post('/api/generate', async (req, res) => {
  try {
    const { markdown } = req.body;
    
    if (!markdown) {
      return res.status(400).json({ error: '缺少 Markdown 文本' });
    }
    
    const timestamp = Date.now();
    const outputFilename = `markmap-${timestamp}`;
    
    // 生成思维导图 HTML
    const htmlPath = await generateMarkmap(markdown, outputFilename);
    
    // 生成思维导图文件 (XMind 格式)
    const xmindPath = await generateXMindFile(markdown, outputFilename);
    
    // 返回文件路径
    res.json({
      html: `/output/${outputFilename}.html`,
      image: `/api/image/${outputFilename}.png`,
      mindmap: `/output/${outputFilename}.json`
    });
  } catch (error) {
    console.error('生成失败:', error);
    res.status(500).json({ error: '生成思维导图失败', details: error.message });
  }
});

// 修改文件上传API，不再同步生成图片
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '缺少文件' });
    }
    
    const timestamp = Date.now();
    const outputFilename = `markmap-${timestamp}`;
    
    // 读取上传的 Markdown 文件
    const markdown = fs.readFileSync(req.file.path, 'utf-8');
    
    // 生成思维导图 HTML
    const htmlPath = await generateMarkmap(markdown, outputFilename);
    
    // 生成思维导图文件 (XMind 格式)
    const xmindPath = await generateXMindFile(markdown, outputFilename);
    
    // 返回文件路径
    res.json({
      html: `/output/${outputFilename}.html`,
      image: `/api/image/${outputFilename}.png`,
      mindmap: `/output/${outputFilename}.json`
    });
  } catch (error) {
    console.error('生成失败:', error);
    res.status(500).json({ error: '生成思维导图失败', details: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务已启动在 http://localhost:${PORT}`);
}); 