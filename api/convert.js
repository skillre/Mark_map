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
    const transformer = new Transformer();
    const { root, features } = transformer.transform(markdown);

    // 返回转换后的数据
    return res.status(200).json({ root, features });
  } catch (error) {
    console.error('转换出错:', error);
    return res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
};