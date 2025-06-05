// Vercel无服务器函数，用于将Markdown转换为思维导图数据

const { Transformer } = require('markmap-lib');

module.exports = async (req, res) => {
  // 设置CORS头，允许跨域请求
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 处理OPTIONS请求（预检请求）
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只接受POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持POST方法' });
  }

  try {
    // 获取请求体中的Markdown内容
    const { markdown } = req.body;

    if (!markdown) {
      return res.status(400).json({ error: '缺少markdown参数' });
    }

    // 使用markmap-lib转换Markdown为思维导图数据
    const transformer = new Transformer({
      bulletListMarker: '-',
      listItemIndent: 'one',  // 修复：使用更可靠的缩进方式
      breaks: true,
      gfm: true,
      pedantic: false,
      commonmark: true,
      // 新增：增强列表支持
      listItemIndent: 'mixed',  // 支持混合缩进
      listItemType: 'dash',     // 明确列表项类型
      // 新增：支持任务列表
      tasklists: true
    });
    
    // 修复：添加预处理步骤处理复杂结构
    const preprocessedMarkdown = markdown
      .replace(/^(\s*)- \[(x| )\] /mg, '$1* ') // 转换任务列表
      .replace(/^(\s*)\d+\. /mg, '$1* ');      // 转换有序列表
    
    const { root, features } = transformer.transform(preprocessedMarkdown);

    // 返回转换后的数据
    return res.status(200).json({ 
      success: true,
      data: { 
        root, 
        features 
      }
    });
  } catch (error) {
    console.error('转换出错:', error);
    return res.status(500).json({ 
      success: false, 
      error: '服务器内部错误', 
      message: error.message 
    });
  }
};