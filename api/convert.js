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
      // 确保列表结构被正确处理
      bulletListMarker: '-',  // 支持 - 作为无序列表标记
      listItemIndent: 'tab',  // 使用制表符缩进列表项
      // 启用更多Markdown特性
      breaks: true,           // 支持换行
      gfm: true,              // 启用GitHub风格Markdown
      // 增强列表支持
      pedantic: false,        // 不使用严格模式，更宽松地解析列表
      commonmark: true        // 使用CommonMark规范解析Markdown
    });
    
    const { root, features } = transformer.transform(markdown);

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