const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * 从 Markdown 生成思维导图 HTML
 * @param {string} markdownContent Markdown 内容
 * @param {string} outputFilename 输出文件名
 * @returns {Promise<string>} HTML 文件路径
 */
async function generateMarkmap(markdownContent, outputFilename) {
  console.log('generateMarkmap: 开始生成思维导图HTML');
  const htmlOutputPath = path.join(config.outputDir, `${outputFilename}.html`);
  
  try {
    // 确保输出目录存在
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }
    
    // 使用CDN资源，但合并为单一CDN以减少请求数
    const markmapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>思维导图</title>
  <!-- 使用单一CDN减少请求数 -->
  <script src="https://cdn.jsdelivr.net/combine/npm/d3@6.7.0,npm/markmap-view@0.14.0,npm/markmap-lib@0.14.0/dist/browser/index.min.js"></script>
  <style>
    html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; }
    body { display: flex; flex-direction: column; }
    #mindmap { flex: 1; width: 100%; }
    .loading { font-family: sans-serif; font-size: 16px; padding: 20px; text-align: center; }
    .error { color: red; padding: 20px; font-family: sans-serif; font-size: 16px; text-align: center; }
    .controls { position: fixed; bottom: 10px; right: 10px; z-index: 1000; background: rgba(255,255,255,0.8); padding: 5px; border-radius: 4px; }
    .controls button { background: #4a6cf7; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-size: 14px; }
    .controls button:hover { background: #3651d4; }
  </style>
</head>
<body>
  <div id="loading" class="loading">正在加载思维导图...</div>
  <div id="error" class="error" style="display:none;"></div>
  <svg id="mindmap" style="display:none;"></svg>
  <div class="controls" style="display:none;">
    <button id="zoomIn">放大</button>
    <button id="zoomOut">缩小</button>
    <button id="resetView">重置视图</button>
  </div>
  <script>
  document.addEventListener('DOMContentLoaded', function() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const svgEl = document.getElementById('mindmap');
    const controlsEl = document.querySelector('.controls');
    
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
        zoom: true,
        maxWidth: 500 // 限制节点最大宽度，提高可读性
      }, root);
      
      // 显示思维导图和控制按钮
      loadingEl.style.display = 'none';
      svgEl.style.display = 'block';
      controlsEl.style.display = 'block';
      
      // 添加缩放控制
      document.getElementById('zoomIn').addEventListener('click', () => {
        mm.rescale(1.2);
      });
      
      document.getElementById('zoomOut').addEventListener('click', () => {
        mm.rescale(0.8);
      });
      
      document.getElementById('resetView').addEventListener('click', () => {
        mm.fit();
      });
      
      // 添加键盘控制
      document.addEventListener('keydown', (e) => {
        if (e.key === '=' || e.key === '+') mm.rescale(1.2);
        if (e.key === '-') mm.rescale(0.8);
        if (e.key === '0') mm.fit();
      });
      
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
    
    console.log('generateMarkmap: HTML生成完成');
    return htmlOutputPath;
  } catch (error) {
    console.error('生成HTML失败详细日志:', error);
    throw new Error(`生成思维导图HTML失败: ${error.message}`);
  }
}

module.exports = {
  generateMarkmap
}; 