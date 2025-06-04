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
 * 从 HTML 生成图片
 * @param {string} htmlPath HTML 文件路径
 * @param {string} outputFilename 输出文件名
 * @returns {Promise<string>} 图片文件路径
 */
async function generateImage(htmlPath, outputFilename) {
  console.log(`generateImage: 开始从HTML生成图片: ${htmlPath}`);
  const imageOutputPath = path.join(outputDir, `${outputFilename}.png`);
  
  // 获取 Chrome 可执行文件路径和浏览器选项
  let options = {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-extensions', '--disable-gpu'],
    headless: true,
    defaultViewport: { width: 1200, height: 800 }
  };
  
  try {
    console.log('配置浏览器环境');
    if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
      // Vercel环境
      console.log('检测到Vercel/AWS Lambda环境');
      try {
        const chromium = require('chrome-aws-lambda');
        options = {
          ...options,
          executablePath: await chromium.executablePath,
          args: [...chromium.args, ...options.args],
        };
        console.log('已加载chrome-aws-lambda');
      } catch (chromiumError) {
        console.error('加载chrome-aws-lambda失败:', chromiumError);
        throw new Error(`无法加载chrome-aws-lambda: ${chromiumError.message}`);
      }
    }

    // 启动浏览器，设置较小的上下文
    console.log('启动浏览器');
    const browser = await puppeteer.launch(options)
      .catch(launchError => {
        console.error('启动浏览器失败:', launchError);
        throw new Error(`启动浏览器失败: ${launchError.message}`);
      });

    try {
      console.log('创建新页面');
      // 简化页面操作，减少内存使用
      const page = await browser.newPage()
        .catch(pageError => {
          console.error('创建页面失败:', pageError);
          throw new Error(`创建页面失败: ${pageError.message}`);
        });
      
      console.log(`导航至HTML页面: ${htmlPath}`);
      await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' })
        .catch(gotoError => {
          console.error('导航到HTML失败:', gotoError);
          throw new Error(`导航到HTML失败: ${gotoError.message}`);
        });
      
      console.log('等待页面加载完成');
      // 给页面一些时间来渲染
      await page.waitForTimeout(1000);
      
      console.log('开始截图');
      // 使用固定尺寸，避免复杂计算
      await page.screenshot({ 
        path: imageOutputPath,
        fullPage: true,
        omitBackground: true
      }).catch(screenshotError => {
        console.error('截图失败:', screenshotError);
        throw new Error(`截图失败: ${screenshotError.message}`);
      });
      
      console.log(`图片已保存至: ${imageOutputPath}`);
      return imageOutputPath;
    } finally {
      console.log('关闭浏览器');
      await browser.close().catch(closeError => {
        console.warn('关闭浏览器出错:', closeError);
      });
    }
  } catch (error) {
    console.error('生成图片过程中出错:', error);
    throw new Error(`生成图片失败: ${error.message}`);
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
    console.log(`图片API被调用: ${req.params.filename}`);
    const filename = req.params.filename.replace(/\.png$/, '');
    // 添加安全检查，防止路径遍历攻击
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: '无效的文件名' });
    }
    
    const htmlPath = path.join(outputDir, `${filename}.html`);
    
    // 检查HTML文件是否存在
    if (!fs.existsSync(htmlPath)) {
      console.error(`HTML文件不存在: ${htmlPath}`);
      return res.status(404).json({ error: '找不到HTML文件', path: htmlPath });
    }

    try {
      // 尝试使用SVG作为占位图
      const placeholderSvgPath = path.join(__dirname, '../public/placeholder.svg');
      const imageOutputPath = path.join(outputDir, `${filename}.png`);
      
      // 如果图片文件已存在，直接返回
      if (fs.existsSync(imageOutputPath)) {
        console.log(`返回PNG图片文件: ${imageOutputPath}`);
        return res.type('image/png').sendFile(imageOutputPath);
      }
      
      // 尝试生成图片，但不阻止流程继续
      console.log('尝试生成PNG图片');
      try {
        await generateImage(htmlPath, filename);
        
        // 图片生成成功，返回
        if (fs.existsSync(imageOutputPath)) {
          console.log('PNG图片生成成功');
          return res.type('image/png').sendFile(imageOutputPath);
        }
      } catch (imageError) {
        console.error('生成PNG图片失败:', imageError);
      }
      
      // 如果有SVG占位图，返回它
      if (fs.existsSync(placeholderSvgPath)) {
        console.log('使用SVG占位图');
        return res.type('image/svg+xml').sendFile(placeholderSvgPath);
      }
      
      // 没有图片可用，告诉客户端查看HTML版本
      console.log('没有可用图片，返回HTML重定向');
      return res.status(307).json({ 
        error: '图片生成不可用',
        redirect: `/output/${filename}.html`,
        message: '图片生成功能在此环境不可用，请使用HTML版本'
      });
      
    } catch (error) {
      console.error('图片处理错误:', error);
      return res.status(500).json({ 
        error: '图片处理错误', 
        details: error.message,
        redirect: `/output/${filename}.html`,
        message: '请使用HTML版本查看思维导图'
      });
    }
  } catch (error) {
    console.error('图片生成失败详细信息:', error);
    res.status(500).json({ error: '生成图片失败', details: error.message });
  }
});

// API 路由 - 从文本生成思维导图
app.post('/api/generate', async (req, res) => {
  try {
    const { markdown } = req.body;
    
    if (!markdown) {
      return res.status(400).json({ error: '缺少 Markdown 文本' });
    }
    
    console.log('开始生成思维导图...');
    const timestamp = Date.now();
    const outputFilename = `markmap-${timestamp}`;
    
    try {
      // 生成思维导图 HTML
      const htmlPath = await generateMarkmap(markdown, outputFilename);
      console.log(`HTML生成成功: ${htmlPath}`);
      
      // 生成思维导图文件 (XMind 格式)
      const xmindPath = await generateXMindFile(markdown, outputFilename);
      console.log(`XMind文件生成成功: ${xmindPath}`);
      
      // 返回文件路径
      res.json({
        html: `/output/${outputFilename}.html`,
        image: `/api/image/${outputFilename}.png`,
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