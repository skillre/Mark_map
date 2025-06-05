const express = require('express');
const path = require('path');

const app = express();

// 正确设置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 确保基础路由处理
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 添加健康检查端点
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 确保所有路由都指向前端入口
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
}); 