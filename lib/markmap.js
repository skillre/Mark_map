import { Transformer } from 'markmap-lib';
import { v4 as uuidv4 } from 'uuid';

// markmap 转换器实例
const transformer = new Transformer();

/**
 * 将Markdown文本转换为markmap数据
 * @param {string} markdown - Markdown文本
 * @returns {Object} markmap数据和HTML内容
 */
export function transformMarkdown(markdown) {
  try {
    // 使用markmap-lib转换markdown为思维导图数据
    const { root, features } = transformer.transform(markdown);
    
    // 生成唯一ID
    const id = uuidv4();
    
    // 生成完整的HTML内容
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markmap - 思维导图</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      height: 100vh;
      width: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background-color: white;
    }
    #markmap {
      width: 100%;
      height: 100%;
      display: block;
    }
    .toolbar {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 10px;
      display: flex;
      gap: 10px;
      z-index: 1000;
    }
    .toolbar button {
      background: #4a90e2;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.3s;
    }
    .toolbar button:hover {
      background: #6c5ce7;
      transform: translateY(-2px);
    }
    .toolbar button svg {
      width: 16px;
      height: 16px;
    }
    /* 为不同节点类型添加不同颜色 */
    .markmap-node-circle {
      fill: #fff;
      stroke-width: 1.5px;
    }
    .markmap-node-text {
      fill: #333;
      font-weight: 400;
    }
    .markmap-node-text tspan {
      font-size: 14px;
    }
    .markmap-link {
      fill: none;
      stroke-width: 1.5px;
    }
    /* 根据级别设置不同颜色 */
    .markmap-node[data-depth="0"] .markmap-node-circle {
      stroke: #e84393;
    }
    .markmap-node[data-depth="1"] .markmap-node-circle {
      stroke: #0984e3;
    }
    .markmap-node[data-depth="2"] .markmap-node-circle {
      stroke: #00b894;
    }
    .markmap-node[data-depth="3"] .markmap-node-circle {
      stroke: #fdcb6e;
    }
    .markmap-node[data-depth="4"] .markmap-node-circle {
      stroke: #e17055;
    }
    .markmap-node[data-depth="0"] .markmap-node-text {
      font-weight: 600;
    }
    /* 连接线颜色 */
    .markmap-link {
      stroke: #ddd;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/d3@6"></script>
  <script src="https://cdn.jsdelivr.net/npm/markmap-view@0.15.4"></script>
</head>
<body>
  <svg id="markmap"></svg>
  
  <script>
    (function() {
      // 解析JSON数据
      const jsonData = ${JSON.stringify({ root, features })};
      
      // 获取SVG元素
      const svgEl = document.getElementById('markmap');
      
      // 初始化Markmap
      const { Markmap } = window.markmap;
      const mm = Markmap.create(svgEl, {
        autoFit: true, // 自动适应窗口大小
        color: (node) => {
          // 根据深度获取不同颜色
          const colors = ['#e84393', '#0984e3', '#00b894', '#fdcb6e', '#e17055'];
          return colors[node.depth % colors.length];
        }
      }, jsonData.root);
      
      // 自适应窗口大小
      window.addEventListener('resize', () => {
        mm.fit();
      });
      
      // 初始适配
      mm.fit();
      
      // 通知父窗口已加载完成
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'iframe-loaded' }, '*');
        }
      } catch (err) {
        console.error('无法通知父窗口加载完成', err);
      }
      
      // 导出SVG
      window.exportSVG = function() {
        try {
          // 清理SVG，添加适当的样式和属性
          const svgElement = document.getElementById('markmap');
          
          // 创建一个新的SVG元素复制
          const svgClone = svgElement.cloneNode(true);
          
          // 添加XML命名空间
          if (!svgClone.getAttribute('xmlns')) {
            svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          }
          
          // 添加内联样式
          const style = document.createElement('style');
          style.textContent = \`
            .markmap-node-circle { fill: #fff; stroke-width: 1.5px; }
            .markmap-node-text { fill: #333; font-weight: 400; }
            .markmap-node-text tspan { font-size: 14px; }
            .markmap-link { fill: none; stroke: #ddd; stroke-width: 1.5px; }
            .markmap-node[data-depth="0"] .markmap-node-circle { stroke: #e84393; }
            .markmap-node[data-depth="1"] .markmap-node-circle { stroke: #0984e3; }
            .markmap-node[data-depth="2"] .markmap-node-circle { stroke: #00b894; }
            .markmap-node[data-depth="3"] .markmap-node-circle { stroke: #fdcb6e; }
            .markmap-node[data-depth="4"] .markmap-node-circle { stroke: #e17055; }
            .markmap-node[data-depth="0"] .markmap-node-text { font-weight: 600; }
          \`;
          svgClone.insertBefore(style, svgClone.firstChild);
          
          // 获取SVG内容
          const svgContent = svgClone.outerHTML;
          
          // 创建Blob
          const blob = new Blob([svgContent], { type: 'image/svg+xml' });
          
          // 创建下载链接
          const url = URL.createObjectURL(blob);
          
          // 尝试向父窗口发送消息
          try {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'svg-export-ready', url: url }, '*');
            }
          } catch (err) {
            console.log('父窗口通信失败，使用本地下载', err);
          }
          
          // 创建下载元素
          const a = document.createElement('a');
          a.href = url;
          a.download = 'mindmap.svg';
          document.body.appendChild(a);
          a.click();
          
          // 清理
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
          
          return true;
        } catch (err) {
          console.error('导出SVG错误:', err);
          
          // 显示错误提示
          try {
            alert('导出SVG失败: ' + err.message);
          } catch(e) {
            console.error('无法显示警告', e);
          }
          
          // 尝试向父窗口发送错误信息
          try {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'svg-export-error', error: err.message }, '*');
            }
          } catch (e) {
            console.error('无法向父窗口发送错误信息', e);
          }
          
          return false;
        }
      }
      
      // 添加工具栏
      const toolbar = document.createElement('div');
      toolbar.className = 'toolbar';
      
      const exportSvgBtn = document.createElement('button');
      exportSvgBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> 导出SVG';
      exportSvgBtn.onclick = window.exportSVG;
      
      const fitBtn = document.createElement('button');
      fitBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg> 适应窗口';
      fitBtn.onclick = () => mm.fit();
      
      toolbar.appendChild(fitBtn);
      toolbar.appendChild(exportSvgBtn);
      document.body.appendChild(toolbar);
    })();
  </script>
</body>
</html>`;

    return {
      success: true,
      id,
      data: { root, features },
      html
    };
  } catch (error) {
    console.error('转换Markdown失败:', error);
    return {
      success: false,
      error: error.message || '转换Markdown失败'
    };
  }
}

/**
 * 获取markmap所需的前端资源引用
 * @returns {Object} 脚本和样式引用
 */
export function getMarkmapAssets() {
  return {
    scripts: [
      'https://cdn.jsdelivr.net/npm/d3@6',
      'https://cdn.jsdelivr.net/npm/markmap-view@0.15.4',
    ],
    styles: []
  };
} 