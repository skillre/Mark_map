import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

// 示例Markdown
const EXAMPLE_MARKDOWN = `# Markmap示例

## 什么是Markmap

Markmap是一个将Markdown转换为思维导图的工具。

### 主要特点

- **简单易用**
  - 基于Markdown语法
  - 无需额外学习
- **功能丰富**
  - 支持大部分Markdown语法
  - 可以导出为图片

## 支持的语法

### 标题结构

使用\`#\`、\`##\`、\`###\`等创建不同级别的节点。

### 列表

- 无序列表使用\`-\`或\`*\`
- 有序列表使用\`1.\`、\`2.\`等
  1. 第一项
  2. 第二项

### 超链接

[访问Markmap官网](https://markmap.js.org/)`;

export default function Home() {
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('editor');
  const [apiStatus, setApiStatus] = useState({ checking: true });
  const [iframeLoading, setIframeLoading] = useState(true);
  const fileInputRef = useRef(null);
  const iframeRef = useRef(null);

  // 监听iframe消息
  useEffect(() => {
    const handleMessage = (event) => {
      // 处理SVG导出消息
      if (event.data && event.data.type === 'svg-export-ready') {
        // 创建下载链接
        const a = document.createElement('a');
        a.href = event.data.url;
        a.download = 'mindmap.svg';
        document.body.appendChild(a);
        a.click();
        
        // 清理
        setTimeout(() => {
          document.body.removeChild(a);
        }, 100);
      } else if (event.data && event.data.type === 'svg-export-error') {
        console.error('iframe导出SVG错误:', event.data.error);
        setError('导出SVG失败: ' + event.data.error);
      } else if (event.data && event.data.type === 'iframe-loaded') {
        // iframe加载完成
        setIframeLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // 检查API健康状态
  useEffect(() => {
    async function checkApiHealth() {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          setApiStatus({ 
            status: 'ok', 
            version: data.version,
            checking: false 
          });
        } else {
          console.error('API健康检查失败:', response.status);
          setApiStatus({ 
            status: 'error', 
            code: response.status,
            checking: false 
          });
        }
      } catch (err) {
        console.error('API健康检查错误:', err);
        setApiStatus({ 
          status: 'error', 
          message: err.message,
          checking: false 
        });
      }
    }
    
    checkApiHealth();
  }, []);

  // 设置示例Markdown
  useEffect(() => {
    setMarkdown(EXAMPLE_MARKDOWN);
    
    // 自动生成初始思维导图
    const autoGenerateInitialMindmap = async () => {
      if (apiStatus.status === 'ok') {
        setLoading(true);
        setError(null);
        setIframeLoading(true);
        
        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ markdown: EXAMPLE_MARKDOWN }),
          });
          
          const data = await response.json();
          
          if (!response.ok || !data.success) {
            throw new Error(data.error || '生成思维导图失败');
          }

          setResult(data);
          // 2秒后自动切换到预览标签，给用户时间看到编辑器
          setTimeout(() => {
            setActiveTab('preview');
          }, 1000);
        } catch (err) {
          console.error('自动生成思维导图错误:', err);
          // 不显示错误，因为是自动生成
        } finally {
          setLoading(false);
        }
      }
    };
    
    // 当API状态可用时自动生成
    if (!apiStatus.checking && apiStatus.status === 'ok') {
      autoGenerateInitialMindmap();
    }
  }, [apiStatus]);

  // 从文本生成思维导图
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!markdown.trim()) {
      setError('请输入Markdown内容');
      return;
    }

    setLoading(true);
    setError(null);
    setIframeLoading(true);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markdown }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '生成思维导图失败');
      }

      setResult(data);
      setActiveTab('preview');
    } catch (err) {
      console.error('生成思维导图错误:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 从文件生成思维导图
  const handleFileUpload = async (e) => {
    e.preventDefault();
    
    const file = fileInputRef.current.files[0];
    
    if (!file) {
      setError('请选择文件');
      return;
    }
    
    if (!file.name.toLowerCase().endsWith('.md')) {
      setError('请上传Markdown文件(.md)');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    setLoading(true);
    setError(null);
    setIframeLoading(true);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '生成思维导图失败');
      }
      
      setResult(data);
      setActiveTab('preview');
    } catch (err) {
      console.error('文件上传错误:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 读取上传的文件内容
  const handleFileRead = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setMarkdown(e.target.result);
    };
    reader.readAsText(file);
  };
  
  // 判断URL是否为数据URL
  const isDataUrl = (url) => {
    return typeof url === 'string' && url.startsWith('data:');
  };

  // 导出SVG
  const exportSVG = () => {
    if (!iframeRef.current) return;
    
    try {
      const iframe = iframeRef.current;
      const iframeWindow = iframe.contentWindow;
      
      // 清除之前的错误
      setError(null);
      
      // 调用iframe内部的exportSVG函数
      if (iframeWindow && typeof iframeWindow.exportSVG === 'function') {
        iframeWindow.exportSVG();
      } else {
        console.error('无法访问iframe内的exportSVG函数');
        setError('导出SVG失败：无法访问思维导图元素，请检查浏览器安全设置');
      }
    } catch (err) {
      console.error('导出SVG错误:', err);
      setError('导出SVG失败: ' + err.message);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Markmap思维导图生成器</title>
        <meta name="description" content="通过Markdown生成思维导图" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Markmap思维导图生成器
        </h1>

        <p className={styles.description}>
          将Markdown文本转换为美观的思维导图
        </p>
        
        {/* API状态显示 */}
        {!apiStatus.checking && (
          <div className={`${styles.apiStatus} ${apiStatus.status === 'ok' ? styles.apiStatusOk : styles.apiStatusError}`}>
            {apiStatus.status === 'ok' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                API状态: 正常
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                API状态: 异常
              </>
            )}
          </div>
        )}

        <div className={styles.tabs}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'editor' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            编辑器
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'preview' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('preview')}
            disabled={!result}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
              <line x1="8" y1="2" x2="8" y2="18"></line>
              <line x1="16" y1="6" x2="16" y2="22"></line>
            </svg>
            预览
          </button>
        </div>

        <div className={styles.tabContent}>
          {activeTab === 'editor' ? (
            <div className={styles.editorContainer}>
              <div className={styles.card}>
                <h2>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  输入Markdown文本
                </h2>
                <form onSubmit={handleSubmit}>
                  <div className={styles.formGroup}>
                    <textarea
                      className={styles.textarea}
                      value={markdown}
                      onChange={(e) => setMarkdown(e.target.value)}
                      placeholder="# 一级标题&#10;## 二级标题&#10;### 三级标题&#10;- 列表项1&#10;  - 子列表项&#10;- 列表项2&#10;&#10;[链接文本](https://example.com)"
                      rows={15}
                    />
                  </div>
                  <div className={styles.buttonGroup}>
                    <button 
                      type="submit" 
                      className={styles.button}
                      disabled={loading || apiStatus.status !== 'ok'}
                    >
                      {loading ? (
                        <>
                          <svg className="loading" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 6v6l4 2"></path>
                          </svg>
                          生成中...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                          </svg>
                          生成思维导图
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              <div className={styles.card}>
                <h2>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  或上传Markdown文件
                </h2>
                <form onSubmit={handleFileUpload}>
                  <div className={styles.formGroup}>
                    <input
                      type="file"
                      accept=".md,text/markdown"
                      ref={fileInputRef}
                      onChange={handleFileRead}
                      className={styles.fileInput}
                      disabled={apiStatus.status !== 'ok'}
                    />
                  </div>
                  <div className={styles.buttonGroup}>
                    <button 
                      type="submit" 
                      className={styles.button}
                      disabled={loading || !fileInputRef.current?.files?.[0] || apiStatus.status !== 'ok'}
                    >
                      {loading ? (
                        <>
                          <svg className="loading" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 6v6l4 2"></path>
                          </svg>
                          上传中...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                          </svg>
                          上传并生成
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {error && (
                <div className={styles.error}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.previewContainer}>
              {result && (
                <>
                  <div className={styles.card}>
                    <h2>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                        <line x1="8" y1="2" x2="8" y2="18"></line>
                        <line x1="16" y1="6" x2="16" y2="22"></line>
                      </svg>
                      思维导图预览
                    </h2>
                    <div className={styles.iframeContainer}>
                      {iframeLoading && (
                        <div className={styles.iframeLoading}>
                          <svg className={styles.loadingSvg} xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 6v6l4 2"></path>
                          </svg>
                          <p>加载思维导图中...</p>
                        </div>
                      )}
                      {isDataUrl(result.files.html) ? (
                        <iframe
                          ref={iframeRef}
                          src={result.files.html}
                          className={styles.iframe}
                          title="思维导图预览"
                          sandbox="allow-scripts allow-same-origin allow-downloads"
                          onLoad={() => setIframeLoading(false)}
                        />
                      ) : (
                        <iframe 
                          ref={iframeRef}
                          src={result.files.html} 
                          className={styles.iframe}
                          title="思维导图预览"
                          sandbox="allow-scripts allow-same-origin allow-downloads"
                          onLoad={() => setIframeLoading(false)}
                        />
                      )}
                    </div>
                  </div>
                  
                  <div className={styles.card}>
                    <h2>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      下载选项
                    </h2>
                    <div className={styles.downloadOptions}>
                      {isDataUrl(result.files.html) ? (
                        <a 
                          href={result.files.html}
                          className={styles.downloadButton}
                          target="_blank"
                          rel="noreferrer"
                          download="mindmap.html"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <polyline points="16 18 18 18 18 18"></polyline>
                          </svg>
                          下载HTML版本
                        </a>
                      ) : (
                        <a 
                          href={result.files.html} 
                          className={styles.downloadButton}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <polyline points="16 18 18 18 18 18"></polyline>
                          </svg>
                          查看HTML版本
                        </a>
                      )}
                      
                      <button 
                        onClick={exportSVG}
                        className={styles.downloadButton}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <path d="M2 15h10"></path>
                          <path d="M5 12l-3 3 3 3"></path>
                        </svg>
                        导出SVG文件
                      </button>
                    </div>
                  </div>
                </>
              )}
              
              <div className={styles.buttonGroup}>
                <button 
                  onClick={() => setActiveTab('editor')}
                  className={styles.button}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5"></path>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                  返回编辑
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <p>
          基于 <a href="https://markmap.js.org/" target="_blank" rel="noreferrer">Markmap</a> 构建
        </p>
      </footer>
    </div>
  );
} 