import multer from 'multer';
import { NextApiRequest, NextApiResponse } from 'next';

// 创建内存存储
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 限制5MB
});

/**
 * 处理文件上传的中间件
 * @param {Object} options - 选项
 * @returns {Function} 文件上传处理中间件
 */
export function uploadMiddleware(options = { fieldName: 'file' }) {
  return async (req, res) => {
    return new Promise((resolve, reject) => {
      const multerUpload = upload.single(options.fieldName);
      
      multerUpload(req, res, (error) => {
        if (error) {
          console.error('文件上传错误:', error);
          reject(error);
        } else {
          resolve(req.file);
        }
      });
    });
  };
}

/**
 * 将NextJS API Route包装为支持文件上传
 * @param {Function} handler - API路由处理函数
 * @param {Object} options - 上传选项
 * @returns {Function} 包装后的处理函数
 */
export function withUpload(handler, options = { fieldName: 'file' }) {
  return async (req, res) => {
    if (req.method === 'POST') {
      try {
        const middleware = uploadMiddleware(options);
        await middleware(req, res);
        return handler(req, res);
      } catch (error) {
        console.error('文件上传处理错误:', error);
        return res.status(500).json({ 
          success: false, 
          error: '文件上传失败', 
          details: error.message 
        });
      }
    } else {
      return res.status(405).json({ 
        success: false, 
        error: '方法不允许' 
      });
    }
  };
} 