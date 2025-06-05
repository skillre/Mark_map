import { useState, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('editor');
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!markdown.trim()) {
      setError('请输入Markdown内容');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markdown }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成思维导图失败');
      }

      const data = await response.json();
      setResult(data);
      setActiveTab('preview');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    const file = fileInputRef.current.files[0];
    
    if (!file) {
      setError('请选择文件');
      return;
    }
    
    if (file.type !== 'text/markdown' && !file.name.endsWith('.md')) {
      setError('请上传Markdown文件');
      return;
    }
    
    formData.append('file', file);
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成思维导图失败');
      }

      const data = await response.json();
      setResult(data);
      setActiveTab('preview');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileRead = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setMarkdown(e.target.result);
    };
    reader.readAsText(file);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Markmap思维导图生成器</title>
        <meta name="description" content="通过Markdown生成思维导图" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Markmap思维导图生成器
        </h1>

        <p className={styles.description}>
          将Markdown文本转换为美观的思维导图
        </p>

        <div className={styles.tabs}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'editor' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            编辑器
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'preview' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('preview')}
            disabled={!result}
          >
            预览
          </button>
        </div>

        <div className={styles.tabContent}>
          {activeTab === 'editor' ? (
            <div className={styles.editorContainer}>
              <div className={styles.card}>
                <h2>输入Markdown文本</h2>
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
                      disabled={loading}
                    >
                      {loading ? '生成中...' : '生成思维导图'}
                    </button>
                  </div>
                </form>
              </div>

              <div className={styles.card}>
                <h2>或上传Markdown文件</h2>
                <form onSubmit={handleFileUpload}>
                  <div className={styles.formGroup}>
                    <input
                      type="file"
                      accept=".md,text/markdown"
                      ref={fileInputRef}
                      onChange={handleFileRead}
                      className={styles.fileInput}
                    />
                  </div>
                  <div className={styles.buttonGroup}>
                    <button 
                      type="submit" 
                      className={styles.button}
                      disabled={loading}
                    >
                      {loading ? '上传中...' : '上传并生成'}
                    </button>
                  </div>
                </form>
              </div>

              {error && (
                <div className={styles.error}>
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.previewContainer}>
              {result && (
                <>
                  <div className={styles.card}>
                    <h2>思维导图预览</h2>
                    <div className={styles.iframeContainer}>
                      <iframe 
                        src={result.files.html} 
                        className={styles.iframe}
                        title="思维导图预览"
                      />
                    </div>
                  </div>
                  
                  <div className={styles.card}>
                    <h2>下载选项</h2>
                    <div className={styles.downloadOptions}>
                      <a 
                        href={result.files.html} 
                        className={styles.downloadButton}
                        target="_blank"
                        rel="noreferrer"
                      >
                        查看HTML版本
                      </a>
                      <a 
                        href={result.files.png} 
                        className={styles.downloadButton}
                        target="_blank"
                        rel="noreferrer"
                      >
                        查看PNG图片
                      </a>
                      <a 
                        href={result.files.png} 
                        className={styles.downloadButton}
                        download="mindmap.png"
                      >
                        下载PNG图片
                      </a>
                    </div>
                  </div>
                </>
              )}
              
              <div className={styles.buttonGroup}>
                <button 
                  onClick={() => setActiveTab('editor')}
                  className={styles.button}
                >
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