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

// 配置存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
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
app.use('/output', express.static(path.join(__dirname, '../output')));

// 确保目录存在
const outputDir = path.join(__dirname, '../output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * 从 Markdown 生成思维导图 HTML
 * @param {string} markdownContent Markdown 内容
 * @param {string} outputPath 输出路径
 * @returns {Promise<string>} HTML 文件路径
 */
async function generateMarkmap(markdownContent, outputFilename) {
  const mdFilePath = path.join(__dirname, '../uploads', `${outputFilename}.md`);
  const htmlOutputPath = path.join(__dirname, '../output', `${outputFilename}.html`);
  
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
  const imageOutputPath = path.join(__dirname, '../output', `${outputFilename}.png`);
  
  // 获取 Chrome 可执行文件路径
  let executablePath;
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    // Vercel 环境
    executablePath = await require('chrome-aws-lambda').executablePath;
  }

  // 启动浏览器
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    executablePath: executablePath,
    headless: "new",
  });

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
  const xmindOutputPath = path.join(__dirname, '../output', `${outputFilename}.json`);
  
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

// API 路由 - 从文本生成思维导图
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
    
    // 生成图片
    const imagePath = await generateImage(htmlPath, outputFilename);
    
    // 生成思维导图文件 (XMind 格式)
    const xmindPath = await generateXMindFile(markdown, outputFilename);
    
    // 返回文件路径
    res.json({
      html: `/output/${outputFilename}.html`,
      image: `/output/${outputFilename}.png`,
      mindmap: `/output/${outputFilename}.json`
    });
  } catch (error) {
    console.error('生成失败:', error);
    res.status(500).json({ error: '生成思维导图失败', details: error.message });
  }
});

// API 路由 - 从文件生成思维导图
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
    
    // 生成图片
    const imagePath = await generateImage(htmlPath, outputFilename);
    
    // 生成思维导图文件 (XMind 格式)
    const xmindPath = await generateXMindFile(markdown, outputFilename);
    
    // 返回文件路径
    res.json({
      html: `/output/${outputFilename}.html`,
      image: `/output/${outputFilename}.png`,
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