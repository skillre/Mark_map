# Markdown思维导图生成器

一个基于markmap-lib的在线思维导图生成服务，可以将Markdown文本转换为交互式思维导图、SVG图片和思维导图文件。

## 功能特点

- 支持通过文本输入或文件上传方式生成思维导图
- 生成三种格式的输出：
  - 交互式HTML思维导图
  - SVG图片
  - 思维导图文件（JSON格式，兼容XMind）
- 标准化API接口，支持API密钥认证和速率限制
- 简洁美观的用户界面
- 优化的内存使用和错误处理
- 支持在Vercel上部署

## 技术栈

- Node.js
- Express.js
- markmap-lib - 用于生成思维导图
- 模块化架构，优化代码组织

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

API文档访问地址：`/api-docs`

### API密钥认证

所有API请求需要包含有效的API密钥。可以通过以下两种方式之一提供：

1. 请求头: `X-API-Key: your-api-key`
2. 查询参数: `?apiKey=your-api-key`

### 标准API (v1)

#### 从文本生成思维导图

```
POST /api/v1/generate
Content-Type: application/json
X-API-Key: your-api-key

{
  "markdown": "# 标题\n## 子标题\n### 三级标题",
  "title": "我的思维导图"
}
```

#### 从文件生成思维导图

```
POST /api/v1/upload
Content-Type: multipart/form-data
X-API-Key: your-api-key

file: <上传的Markdown文件>
```

#### 响应格式

```json
{
  "success": true,
  "data": {
    "id": "markmap-1234567890-abcd",
    "title": "我的思维导图",
    "created_at": "2023-01-01T12:00:00.000Z",
    "links": {
      "html": "/output/markmap-1234567890-abcd.html",
      "svg": "/api/image/markmap-1234567890-abcd.svg",
      "mindmap": "/output/markmap-1234567890-abcd.json"
    },
    "urls": {
      "html_url": "https://your-domain.com/output/markmap-1234567890-abcd.html",
      "svg_url": "https://your-domain.com/api/image/markmap-1234567890-abcd.svg",
      "mindmap_url": "https://your-domain.com/output/markmap-1234567890-abcd.json"
    }
  }
}
```

### 兼容性API (旧版)

为保持向后兼容，以下接口依然可用：

```
POST /api/generate
POST /api/upload
```

## 环境变量配置

- `PORT`: 服务运行端口（默认: 3000）
- `API_KEYS`: 以逗号分隔的API密钥列表（默认: "dev-key,test-key"）
- `API_RATE_LIMIT`: 每个API密钥每小时的请求限制（默认: 100）

## 注意事项

- 只有Markdown标题会被解析为思维导图节点
- 超过500KB的Markdown文件将被拒绝处理
- 生成的文件会在服务器上临时存储24小时

## 许可证

MIT 