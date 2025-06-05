import { Markmap } from 'markmap-view';

function MarkmapEditor() {
  const [markdown, setMarkdown] = useState(`# 思维导图\n## 子主题`);
  
  useEffect(() => {
    // 实时渲染思维导图
    const { root } = transform(markdown);
    Markmap.create('#mindmap', null, root);
  }, [markdown]);

  const exportFiles = async () => {
    // 调用后端生成文件
    const res = await fetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ markdown })
    });
    const { svg, png, xmind } = await res.json();
    downloadFile(svg, 'mindmap.svg');
    downloadFile(png, 'mindmap.png');
    downloadFile(xmind, 'mindmap.xmind');
  };

  return (
    <div>
      <textarea value={markdown} onChange={e => setMarkdown(e.target.value)} />
      <div id="mindmap"></div>
      <button onClick={exportFiles}>导出文件</button>
    </div>
  );
} 