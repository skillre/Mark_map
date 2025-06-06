const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// 创建Express应用
const app = express();
app.use(express.json());

// 临时目录和输出目录
const tempDir = '/tmp/temp';
const outputDir = '/tmp/output';

// 确保目录存在
try {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
} catch (error) {
  console.error('创建目录失败:', error);
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

// 健康检查API
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0',
    time: new Date().toISOString()
  });
});

// 生成思维导图API
app.post('/generate', async (req, res) => {
  console.log('收到生成请求:', req.body);
  
  try {
    const { markdown } = req.body;
    if (!markdown) {
      return res.status(400).json({ error: '缺少markdown内容' });
    }

    // 生成唯一ID
    const id = uuidv4();
    const mdFilePath = path.join(tempDir, `${id}.md`);
    const htmlFilePath = path.join(outputDir, `${id}.html`);

    // 保存Markdown文件
    fs.writeFileSync(mdFilePath, markdown);
    console.log('已保存Markdown文件:', mdFilePath);

    // 使用markmap-cli生成HTML
    await new Promise((resolve, reject) => {
      const command = `npx markmap-cli ${mdFilePath} -o ${htmlFilePath}`;
      console.log('执行命令:', command);
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('命令执行错误:', error);
          console.error('stderr:', stderr);
          reject(error);
          return;
        }
        console.log('命令输出:', stdout);
        resolve();
      });
    });

    // 读取生成的HTML
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
    console.log('HTML内容长度:', htmlContent.length);

    // 返回数据URL
    res.json({
      success: true,
      files: {
        html: `data:text/html;base64,${Buffer.from(htmlContent).toString('base64')}`
      }
    });
  } catch (error) {
    console.error('生成思维导图错误:', error);
    res.status(500).json({ error: '生成思维导图失败', details: error.message });
  }
});

// 上传文件生成思维导图API
app.post('/upload', upload.single('file'), async (req, res) => {
  console.log('收到上传请求');
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    console.log('已上传文件:', req.file.path);

    // 获取文件信息
    const id = path.basename(req.file.filename, path.extname(req.file.filename));
    const mdFilePath = req.file.path;
    const htmlFilePath = path.join(outputDir, `${id}.html`);

    // 使用markmap-cli生成HTML
    await new Promise((resolve, reject) => {
      const command = `npx markmap-cli ${mdFilePath} -o ${htmlFilePath}`;
      console.log('执行命令:', command);
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('命令执行错误:', error);
          console.error('stderr:', stderr);
          reject(error);
          return;
        }
        console.log('命令输出:', stdout);
        resolve();
      });
    });

    // 读取生成的HTML
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
    console.log('HTML内容长度:', htmlContent.length);

    // 返回数据URL
    res.json({
      success: true,
      files: {
        html: `data:text/html;base64,${Buffer.from(htmlContent).toString('base64')}`
      }
    });
  } catch (error) {
    console.error('生成思维导图错误:', error);
    res.status(500).json({ error: '生成思维导图失败', details: error.message });
  }
});

module.exports = app; 