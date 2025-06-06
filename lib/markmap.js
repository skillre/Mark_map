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
  <title>Markmap</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      height: 100vh;
      width: 100%;
      overflow: hidden;
    }
    #markmap {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/d3@6"></script>
  <script src="https://cdn.jsdelivr.net/npm/markmap-view@0.15.4"></script>
</head>
<body>
  <svg id="markmap"></svg>
  <script>
    (function() {
      const jsonData = ${JSON.stringify({ root, features })};
      const { Markmap } = window.markmap;
      const markmap = Markmap.create('#markmap', null, jsonData.root);
      window.addEventListener('resize', () => {
        markmap.fit();
      });
      markmap.fit();
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