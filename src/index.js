const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const apiRoutes = require('./routes/api');
const fileUtils = require('./utils/fileUtils');

const app = express();

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '1mb' })); 
app.use(express.urlencoded({ extended: true, limit: '1mb' })); 
app.use(express.static(config.publicDir));
app.use('/output', express.static(config.outputDir));

// 添加API路由
app.use('/api', apiRoutes);

// 重定向根路径到首页
app.get('/', (req, res) => {
  res.sendFile(path.join(config.publicDir, 'index.html'));
});

// API文档路由
app.get('/api-docs', (req, res) => {
  res.sendFile(path.join(config.publicDir, 'api-docs.html'));
});

// 设置定期清理任务
setInterval(() => {
  fileUtils.cleanupTempFiles();
}, 24 * 60 * 60 * 1000); // 每24小时清理一次

// 启动服务器
if (!module.parent) {
  app.listen(config.PORT, () => {
    console.log(`服务器运行在 http://localhost:${config.PORT}`);
    console.log(`API文档: http://localhost:${config.PORT}/api-docs`);
    console.log(`可用API密钥: ${config.API_KEYS.join(', ')}`);
  });
}

module.exports = app; 