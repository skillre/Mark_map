const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;
const isVercel = process.env.VERCEL === '1';

// 在Vercel环境中使用/tmp目录
const baseDir = isVercel ? '/tmp' : __dirname;
const tempDir = path.join(baseDir, 'temp');
const outputDir = path.join(baseDir, 'output');

// 指定静态文件目录
if (!isVercel) {
  app.use(express.static('public'));
  app.use(express.static('output'));
}
app.use(express.json());

// 确保目录存在
try {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
} catch (err) {
  console.error('创建目录失败:', err);
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

    // 读取生成的HTML内容
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

    if (isVercel) {
      // Vercel环境中，将数据作为Base64返回
      res.json({
        success: true,
        files: {
          html: `data:text/html;base64,${Buffer.from(htmlContent).toString('base64')}`
        }
      });
    } else {
      // 本地环境，返回文件URL
      res.json({
        success: true,
        files: {
          html: `/api/file/${id}.html`
        }
      });
    }
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

    // 读取生成的HTML内容
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

    if (isVercel) {
      // Vercel环境中，将数据作为Base64返回
      res.json({
        success: true,
        files: {
          html: `data:text/html;base64,${Buffer.from(htmlContent).toString('base64')}`
        }
      });
    } else {
      // 本地环境，返回文件URL
      res.json({
        success: true,
        files: {
          html: `/api/file/${id}.html`
        }
      });
    }
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

// 如果在Vercel环境中，使用API路由
if (isVercel) {
  console.log('运行在Vercel环境中');
  module.exports = app;
} else {
  // 本地开发环境，处理对Next.js应用的请求
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
} 