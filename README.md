# Markdown思维导图生成器

一个基于markmap-cli的在线思维导图生成服务，可以将Markdown文本转换为交互式思维导图、PNG图片和思维导图文件。

## 功能特点

- 支持通过文本输入或文件上传方式生成思维导图
- 生成三种格式的输出：
  - 交互式HTML思维导图
  - PNG图片
  - 思维导图文件（JSON格式，兼容XMind）
- 简洁美观的用户界面
- 支持在Vercel上部署

## 技术栈

- Node.js
- Express.js
- markmap-cli
- Puppeteer (用于生成PNG图片)

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

4. 访问 http://localhost:3000

## 部署到Vercel

本项目已配置为可以直接部署到Vercel。

1. 在Vercel上创建新项目
2. 导入此Git仓库
3. 部署

## API使用

### 从文本生成思维导图

```
POST /api/generate
Content-Type: application/json

{
  "markdown": "# 标题\n## 子标题\n### 三级标题"
}
```

### 从文件生成思维导图

```
POST /api/upload
Content-Type: multipart/form-data

file: <上传的Markdown文件>
```

### 响应格式

```json
{
  "html": "/output/markmap-1234567890.html",
  "image": "/output/markmap-1234567890.png",
  "mindmap": "/output/markmap-1234567890.json"
}
```

## 注意事项

- 只有Markdown标题会被解析为思维导图节点
- 正文内容不会显示在思维导图中
- 生成的文件会临时存储在服务器上

## 许可证

MIT 