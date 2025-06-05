const express = require('express');
const path = require('path');
const basicAuth = require('basic-auth');

const app = express();

// 正确设置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 确保基础路由处理
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 添加健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// 确保所有路由都指向前端入口
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 添加内存监控
setInterval(() => {
  const used = process.memoryUsage();
  console.log(`内存使用: ${JSON.stringify(used)}`);
}, 5000);

// 添加基本错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.stack);
  res.status(500).send('服务器内部错误');
}); 