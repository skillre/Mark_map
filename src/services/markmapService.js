const fs = require('fs');
const path = require('path');
const { Transformer } = require('markmap-lib');
const config = require('../config');

// 创建Transformer实例
const transformer = new Transformer();

/**
 * 从 Markdown 生成思维导图 HTML
 * @param {string} markdownContent Markdown 内容
 * @param {string} outputFilename 输出文件名
 * @returns {Promise<string>} HTML 文件路径
 */
async function generateMarkmap(markdownContent, outputFilename) {
  console.log('generateMarkmap: 开始生成思维导图HTML');
  const htmlOutputPath = path.join(config.outputDir, `${outputFilename}.html`);
  
  // 限制过大的文件，防止内存溢出
  if (markdownContent.length > config.MAX_MARKDOWN_SIZE) {
    throw new Error('Markdown文件过大，请减小文件大小');
  }
  
  try {
    // 确保输出目录存在
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
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
 * 直接从Markdown生成SVG思维导图
 * @param {string} markdownContent Markdown内容
 * @param {string} outputFilename 输出文件名
 * @returns {Promise<string>} SVG文件路径
 */
async function generateSvgMarkmap(markdownContent, outputFilename) {
  console.log(`generateSvgMarkmap: 开始生成SVG: ${outputFilename}`);
  const svgOutputPath = path.join(config.outputDir, `${outputFilename}.svg`);
  
  try {
    // 确保输出目录存在
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }
    
    // 使用markmap-lib将Markdown转换为思维导图数据
    const { root, features } = transformer.transform(markdownContent);
    
    // 基本SVG模板，包含必要的样式和JavaScript
    const svgTemplate = `
<svg xmlns="http://www.w3.org/2000/svg" class="markmap" width="800" height="800" style="background-color: white;">
  <style>
    .markmap-node {
      cursor: pointer;
    }
    .markmap-node-circle {
      fill: #fff;
      stroke-width: 1.5px;
    }
    .markmap-node-text {
      fill: #000;
      font: 10px sans-serif;
    }
    .markmap-link {
      fill: none;
    }
  </style>
  <g transform="translate(400, 400)">
    <text x="0" y="0" text-anchor="middle" style="font-family: Arial; font-size: 20px; fill: #333;">
      思维导图静态预览
    </text>
    <text x="0" y="30" text-anchor="middle" style="font-family: Arial; font-size: 16px; fill: #666;">
      请使用HTML版本获取完整交互体验
    </text>
    <g transform="translate(0, 70)">
      <text x="0" y="0" text-anchor="middle" style="font-family: Arial; font-size: 14px; fill: #333; font-weight: bold;">
        ${root.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </text>
      ${root.children.map((child, i) => `
        <line x1="0" y1="10" x2="${-100 + i * 200/(root.children.length || 1)}" y2="${40}" 
              style="stroke: #999; stroke-width: 1px;"></line>
        <text x="${-100 + i * 200/(root.children.length || 1)}" y="${50}" 
              text-anchor="middle" style="font-family: Arial; font-size: 12px; fill: #666;">
          ${child.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </text>
      `).join('')}
    </g>
  </g>
  <text x="400" y="750" text-anchor="middle" style="font-family: Arial; font-size: 14px; fill: #999;">
    这是静态SVG预览，请使用HTML版本获取完整的交互式思维导图
  </text>
</svg>`;

    // 写入SVG文件
    console.log(`写入SVG文件: ${svgOutputPath}`);
    fs.writeFileSync(svgOutputPath, svgTemplate);
    
    // 检查文件是否成功生成
    if (!fs.existsSync(svgOutputPath)) {
      throw new Error('未能创建SVG文件');
    }
    
    console.log('generateSvgMarkmap: SVG生成完成');
    return svgOutputPath;
  } catch (error) {
    console.error('生成SVG失败详细日志:', error);
    throw new Error(`生成SVG思维导图失败: ${error.message}`);
  }
}

/**
 * 生成简单的 XMind 兼容格式
 * @param {string} markdownContent Markdown 内容
 * @param {string} outputFilename 输出文件名
 * @returns {Promise<string>} XMind 文件路径
 */
async function generateXMindFile(markdownContent, outputFilename) {
  console.log(`generateXMindFile: 开始生成思维导图文件: ${outputFilename}`);
  const xmindOutputPath = path.join(config.outputDir, `${outputFilename}.json`);
  
  try {
    // 确保输出目录存在
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }
    
    // 只处理标题行，减少内存占用
    const lines = markdownContent
      .split('\n')
      .filter(line => line.trim().startsWith('#'))
      .slice(0, config.MAX_NODES); // 限制最大节点数
    
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
    console.log(`写入JSON文件: ${xmindOutputPath}`);
    fs.writeFileSync(xmindOutputPath, JSON.stringify(rootNode, null, 2));
    
    // 检查文件是否成功生成
    if (!fs.existsSync(xmindOutputPath)) {
      throw new Error('未能创建JSON文件');
    }
    
    // 获取文件状态信息
    const stats = fs.statSync(xmindOutputPath);
    console.log(`JSON文件创建成功，大小: ${stats.size} 字节, 路径: ${xmindOutputPath}`);
    
    // 在Vercel环境中，打印目录内容以辅助调试
    if (config.isVercel) {
      console.log('列出输出目录内容:');
      const files = fs.readdirSync(config.outputDir);
      files.forEach(file => {
        const filePath = path.join(config.outputDir, file);
        const fileStats = fs.statSync(filePath);
        console.log(`- ${file} (${fileStats.size} 字节)`);
      });
    }
    
    console.log('generateXMindFile: JSON生成完成');
    return xmindOutputPath;
  } catch (error) {
    console.error('生成JSON思维导图文件失败详细日志:', error);
    throw new Error(`生成思维导图文件失败: ${error.message}`);
  }
}

/**
 * 生成内联SVG响应
 * @param {string} message 显示的消息
 * @param {boolean} isError 是否为错误消息
 * @returns {string} 内联SVG标记
 */
function generateInlineSvg(message, isError = false) {
  const bgColor = isError ? '#fee' : '#f8f9fa';
  const textColor = isError ? '#c00' : '#666';
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <rect width="100%" height="100%" fill="${bgColor}"/>
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="${textColor}" text-anchor="middle">
      ${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
    </text>
    <text x="50%" y="50%" dy="30" font-family="Arial, sans-serif" font-size="18" fill="#999" text-anchor="middle">
      请使用HTML版本查看
    </text>
  </svg>`;
}

module.exports = {
  generateMarkmap,
  generateSvgMarkmap,
  generateXMindFile,
  generateInlineSvg
}; 