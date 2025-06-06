// 这个API端点将在server.js中处理
// 由于我们使用了自定义服务器，这个文件只是作为占位符

import { transformMarkdown } from '../../lib/markmap';

/**
 * 从Markdown文本生成思维导图
 * @param {import('next').NextApiRequest} req 
 * @param {import('next').NextApiResponse} res 
 */
export default function handler(req, res) {
  // 只接受POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: '方法不允许' 
    });
  }

  try {
    const { markdown } = req.body;

    // 验证输入
    if (!markdown || typeof markdown !== 'string') {
      return res.status(400).json({
        success: false,
        error: '缺少有效的markdown内容'
      });
    }

    // 转换Markdown为思维导图
    const result = transformMarkdown(markdown);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || '生成思维导图失败'
      });
    }

    // 返回结果
    return res.status(200).json({
      success: true,
      data: result.data,
      id: result.id,
      files: {
        html: `data:text/html;base64,${Buffer.from(result.html).toString('base64')}`
      }
    });
  } catch (error) {
    console.error('生成思维导图错误:', error);
    return res.status(500).json({
      success: false,
      error: '生成思维导图失败',
      details: error.message
    });
  }
} 