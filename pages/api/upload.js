import { withUpload } from '../../lib/upload';
import { transformMarkdown } from '../../lib/markmap';

/**
 * 从上传的Markdown文件生成思维导图
 * @param {import('next').NextApiRequest} req 
 * @param {import('next').NextApiResponse} res 
 */
async function handler(req, res) {
  try {
    // 获取上传的文件
    const file = req.file;
    
    // 验证文件
    if (!file) {
      return res.status(400).json({
        success: false,
        error: '未上传文件'
      });
    }
    
    // 确保是Markdown文件
    if (!file.originalname.endsWith('.md') && file.mimetype !== 'text/markdown') {
      return res.status(400).json({
        success: false,
        error: '请上传Markdown文件'
      });
    }

    // 转换文件内容为思维导图
    const markdown = file.buffer.toString('utf-8');
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
    console.error('文件上传处理错误:', error);
    return res.status(500).json({
      success: false,
      error: '处理上传文件失败',
      details: error.message
    });
  }
}

// 包装处理函数以支持文件上传
export default withUpload(handler);

// 禁用Next.js的默认body解析
export const config = {
  api: {
    bodyParser: false,
  },
}; 