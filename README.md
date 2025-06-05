# Markmap思维导图生成器

这是一个基于markmap-cli构建的思维导图生成服务，可以将Markdown文本转换为交互式思维导图和图片。

## 功能特点

- 支持Markdown文本直接转换为思维导图
- 支持上传Markdown文件生成思维导图
- 生成HTML格式的交互式思维导图
- 自动生成PNG格式的思维导图图片
- 美观的用户界面，操作简单

## 支持的Markdown语法

- 标题结构（使用#、##、###等）
- 列表结构（有序和无序列表）
- 超链接
- 粗体、斜体等基本格式

## 技术栈

- 前端：Next.js、React
- 后端：Express.js
- 思维导图生成：markmap-cli
- 图片生成：Puppeteer

## 本地开发

1. 克隆仓库
```
git clone <仓库地址>
cd markmap-service
```

2. 安装依赖
```
npm install
```

3. 启动开发服务器
```
npm run dev
```

4. 访问 http://localhost:3000 查看应用

## 部署

项目配置了Vercel部署文件，可以直接部署到Vercel平台。

## 使用示例

1. 在编辑器中输入Markdown文本或上传Markdown文件
2. 点击"生成思维导图"按钮
3. 在预览页面查看生成的思维导图
4. 下载HTML或PNG格式的思维导图

## 许可证

MIT 