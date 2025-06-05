const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');

const app = express();
const port = process.env.PORT || 3000;

// 指定静态文件目录
app.use(express.static('public'));
app.use(express.static('output'));
app.use(express.json());

// 创建必要的目录
const tempDir = path.join(__dirname, 'temp');
const outputDir = path.join(__dirname, 'output');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// 文件上传配置
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, tempDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = uuidv4();
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// 从文本生成思维导图HTML
app.post('/api/generate', async (req, res) => {
  try {
    const { markdown } = req.body;
    if (!markdown) {
      return res.status(400).json({ error: '缺少markdown内容' });
    }

    const id = uuidv4();
    const mdFilePath = path.join(tempDir, `${id}.md`);
    const htmlFilePath = path.join(outputDir, `${id}.html`);
    const pngFilePath = path.join(outputDir, `${id}.png`);

    // 保存markdown到临时文件
    fs.writeFileSync(mdFilePath, markdown);

    // 使用markmap-cli生成HTML思维导图
    await new Promise((resolve, reject) => {
      exec(`npx markmap-cli ${mdFilePath} -o ${htmlFilePath}`, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    // 使用puppeteer生成PNG图片
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(`file://${htmlFilePath}`, { waitUntil: 'networkidle0' });
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
    
    // 等待markmap渲染完成
    await page.waitForFunction('typeof markmap !== "undefined" && document.querySelector("svg g")');
    
    // 获取SVG内容区域尺寸
    const dimensions = await page.evaluate(() => {
      const svg = document.querySelector('svg');
      const bbox = svg.querySelector('g').getBBox();
      return {
        width: Math.ceil(bbox.width) + 100,
        height: Math.ceil(bbox.height) + 100
      };
    });
    
    // 重新设置视口大小
    await page.setViewport({ 
      width: dimensions.width, 
      height: dimensions.height, 
      deviceScaleFactor: 2 
    });
    
    // 截图
    await page.screenshot({ path: pngFilePath });
    await browser.close();

    res.json({
      success: true,
      files: {
        html: `/api/file/${id}.html`,
        png: `/api/file/${id}.png`,
      }
    });
  } catch (error) {
    console.error('生成思维导图错误:', error);
    res.status(500).json({ error: '生成思维导图失败', details: error.message });
  }
});

// 从文件生成思维导图HTML
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const id = path.basename(req.file.filename, path.extname(req.file.filename));
    const mdFilePath = req.file.path;
    const htmlFilePath = path.join(outputDir, `${id}.html`);
    const pngFilePath = path.join(outputDir, `${id}.png`);

    // 使用markmap-cli生成HTML思维导图
    await new Promise((resolve, reject) => {
      exec(`npx markmap-cli ${mdFilePath} -o ${htmlFilePath}`, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    // 使用puppeteer生成PNG图片
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(`file://${htmlFilePath}`, { waitUntil: 'networkidle0' });
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
    
    // 等待markmap渲染完成
    await page.waitForFunction('typeof markmap !== "undefined" && document.querySelector("svg g")');
    
    // 获取SVG内容区域尺寸
    const dimensions = await page.evaluate(() => {
      const svg = document.querySelector('svg');
      const bbox = svg.querySelector('g').getBBox();
      return {
        width: Math.ceil(bbox.width) + 100,
        height: Math.ceil(bbox.height) + 100
      };
    });
    
    // 重新设置视口大小
    await page.setViewport({ 
      width: dimensions.width, 
      height: dimensions.height, 
      deviceScaleFactor: 2 
    });
    
    // 截图
    await page.screenshot({ path: pngFilePath });
    await browser.close();

    res.json({
      success: true,
      files: {
        html: `/api/file/${id}.html`,
        png: `/api/file/${id}.png`,
      }
    });
  } catch (error) {
    console.error('生成思维导图错误:', error);
    res.status(500).json({ error: '生成思维导图失败', details: error.message });
  }
});

// 访问生成的文件
app.get('/api/file/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(outputDir, filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: '文件不存在' });
  }
});

// 处理对Next.js应用的请求
const next = require('next');
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  app.all('*', (req, res) => {
    return handle(req, res);
  });

  app.listen(port, () => {
    console.log(`服务启动成功，端口: ${port}`);
  });
}); 