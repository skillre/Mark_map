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
app.use(express.json({ limit: '1mb' })); // 限制JSON大小
app.use(express.urlencoded({ extended: true, limit: '1mb' })); // 限制表单大小
app.use(express.static(path.join(__dirname, '../public')));
app.use('/output', express.static(outputDir));

// 添加基本错误处理中间件
app.use((err, req, res, next) => {
  console.error('应用错误:', err);
  res.status(500).json({ error: '服务器错误', details: err.message });
});

/**
 * 从 Markdown 生成思维导图 HTML
 * @param {string} markdownContent Markdown 内容
 * @param {string} outputFilename 输出文件名
 * @returns {Promise<string>} HTML 文件路径
 */
async function generateMarkmap(markdownContent, outputFilename) {
  const mdFilePath = path.join(uploadDir, `${outputFilename}.md`);
  const htmlOutputPath = path.join(outputDir, `${outputFilename}.html`);
  
  // 限制过大的文件，防止内存溢出
  if (markdownContent.length > 500000) { // 约500KB限制
    throw new Error('Markdown文件过大，请减小文件大小');
  }
  
  // 写入 markdown 文件
  fs.writeFileSync(mdFilePath, markdownContent);
  
  try {
    // 确保生成输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 使用 markmap-cli 最新版本0.18.11生成HTML
    // 添加参数 --offline 以便在Vercel环境中能离线使用
    const command = `npx markmap-cli ${mdFilePath} -o ${htmlOutputPath} --offline --no-open`;
    
    try {
      await execPromise(command);
    } catch (cmdError) {
      console.error('Markmap命令执行错误:', cmdError);
      
      // 如果命令失败，尝试使用备选方案：生成一个最小的html文件
      const minimalHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markmap</title>
  <script src="https://cdn.jsdelivr.net/npm/markmap-autoloader@0.18.11"></script>
  <style>
    html, body, svg { height: 100%; width: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <svg id="mindmap"></svg>
  <script>
    const markdown = ${JSON.stringify(markdownContent)};
    window.markmap.autoLoader.renderString(markdown, document.getElementById('mindmap'));
  </script>
</body>
</html>`;
      
      fs.writeFileSync(htmlOutputPath, minimalHtml);
      console.log('使用备选方案生成HTML');
    }
    
    // 检查文件是否成功生成
    if (!fs.existsSync(htmlOutputPath)) {
      throw new Error('未能创建HTML文件');
    }
    
    return htmlOutputPath;
  } catch (error) {
    console.error('生成HTML失败:', error);
    throw new Error('生成思维导图HTML失败');
  } finally {
    // 清理临时markdown文件
    try {
      fs.unlinkSync(mdFilePath);
    } catch (e) {
      // 忽略清理错误
    }
  }
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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-extensions', '--disable-gpu'],
    headless: true,
    defaultViewport: { width: 1200, height: 800 }
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

  // 启动浏览器，设置较小的上下文
  const browser = await puppeteer.launch(options);

  try {
    // 简化页面操作，减少内存使用
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' });
    
    // 使用固定尺寸，避免复杂计算
    await page.screenshot({ 
      path: imageOutputPath,
      fullPage: true,
      omitBackground: true
    });
    
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

// 新增API端点 - 从HTML生成图片
app.get('/api/image/:filename', async (req, res) => {
  try {
    const filename = req.params.filename.replace(/\.png$/, '');
    // 添加安全检查，防止路径遍历攻击
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: '无效的文件名' });
    }
    
    const htmlPath = path.join(outputDir, `${filename}.html`);
    
    // 检查HTML文件是否存在
    if (!fs.existsSync(htmlPath)) {
      return res.status(404).json({ error: '找不到HTML文件' });
    }
    
    // 设置超时
    const timeout = setTimeout(() => {
      res.status(408).json({ error: '生成图片超时' });
    }, 9000); // 9秒超时，Vercel函数最长10秒
    
    try {
      // 生成图片
      const imageOutputPath = path.join(outputDir, `${filename}.png`);
      
      // 检查图片是否已经存在
      if (fs.existsSync(imageOutputPath)) {
        clearTimeout(timeout);
        // 图片已存在，直接发送
        return res.type('image/png').sendFile(imageOutputPath);
      }
      
      // 生成图片
      await generateImage(htmlPath, filename);
      
      clearTimeout(timeout);
      
      // 发送图片
      if (fs.existsSync(imageOutputPath)) {
        return res.type('image/png').sendFile(imageOutputPath);
      } else {
        throw new Error('生成图片失败');
      }
    } catch (error) {
      clearTimeout(timeout);
      throw error;
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

// 启动服务器（仅在直接运行时，非 Vercel 环境）
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_VERSION) {
  app.listen(PORT, () => {
    console.log(`服务已启动在 http://localhost:${PORT}`);
  });
}

// 导出应用供 Vercel 使用
module.exports = app; 