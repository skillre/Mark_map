// 定义一个全局初始化函数，可以在本地备份库加载后调用
window.initApp = function() {
    console.log('初始化应用...');
    
    // 检查全局对象
    console.log('检查全局对象:', {
        'd3存在': typeof d3 !== 'undefined',
        'markmap存在': typeof window.markmap !== 'undefined',
        'markmapLib存在': typeof window.markmapLib !== 'undefined',
        'markmapToolbar存在': typeof window.markmapToolbar !== 'undefined'
    });
    
    // 初始化应用逻辑
    initializeApp();
};

// 主应用逻辑
function initializeApp() {
    // 获取DOM元素
    const editor = document.getElementById('editor');
    const generateBtn = document.getElementById('generate-btn');
    const clearBtn = document.getElementById('clear-btn');
    const saveBtn = document.getElementById('save-btn');
    const mindmapContainer = document.getElementById('mindmap');
    const loadingIndicator = document.getElementById('loading');

    // 初始化markmap
    let markmapInstance;
    
    // 示例Markdown内容
    const examples = {
        basic: `# Markdown思维导图

## 基础语法
### 标题
#### 一级标题 #
#### 二级标题 ##
#### 三级标题 ###

### 列表
#### 无序列表
- 项目1
- 项目2
- 项目3

#### 有序列表
1. 第一项
2. 第二项
3. 第三项

### 强调
#### *斜体*
#### **粗体**
#### ***粗斜体***

## 链接和图片
### [链接文本](https://example.com)
### ![图片描述](图片URL)
`,
        advanced: `# 项目规划

## 前端开发
### UI设计
- 色彩方案
  - 主色调: #4CAF50
  - 辅助色: #2196F3
  - 强调色: #FF5722
- 布局设计
  - 响应式设计
  - 移动优先
- 交互设计
  - 动画效果
  - 用户反馈

### 技术栈
- HTML5/CSS3
- JavaScript
  - Vue.js
  - React
- 构建工具
  - Webpack
  - Vite

## 后端开发
### 服务器
- Node.js
- Python
  - Django
  - Flask
- Java
  - Spring Boot

### 数据库
- 关系型
  - MySQL
  - PostgreSQL
- NoSQL
  - MongoDB
  - Redis

## 部署
### 云服务
- AWS
- Azure
- Google Cloud

### CI/CD
- GitHub Actions
- Jenkins
- GitLab CI
`
    };

    // 初始化函数
    function init() {
        // 设置默认内容
        editor.value = '# Markdown思维导图\n\n## 在左侧编辑Markdown\n\n### 点击「生成思维导图」按钮\n\n#### 或者尝试加载示例';
        
        // 绑定事件
        generateBtn.addEventListener('click', generateMindmap);
        clearBtn.addEventListener('click', clearEditor);
        saveBtn.addEventListener('click', saveSvg);
        
        // 初始生成思维导图
        generateMindmap();
    }

    // 生成思维导图
    function generateMindmap() {
        console.log('开始生成思维导图...');
        const markdown = editor.value;
        if (!markdown.trim()) {
            alert('请输入Markdown内容');
            return;
        }

        // 显示加载指示器
        loadingIndicator.style.display = 'block';
        
        // 再次检查全局对象
        console.log('生成思维导图前检查全局对象:', {
            'd3存在': typeof d3 !== 'undefined',
            'markmap存在': typeof window.markmap !== 'undefined',
            'markmapLib存在': typeof window.markmapLib !== 'undefined',
            'markmapToolbar存在': typeof window.markmapToolbar !== 'undefined'
        });
        
        // 使用setTimeout让UI有时间更新
        setTimeout(() => {
            try {
                console.log('清空容器并创建SVG元素...');
                // 清空现有内容
                mindmapContainer.innerHTML = '';
                
                // 创建SVG元素
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '100%');
                svg.setAttribute('height', '100%');
                mindmapContainer.appendChild(svg);
                
                // 使用markmap转换Markdown为思维导图
                if (!window.markmap) {
                    console.error('window.markmap对象不存在');
                    throw new Error('markmap库未正确加载，请刷新页面重试');
                }
                
                if (!window.markmapLib) {
                    console.error('window.markmapLib对象不存在');
                    throw new Error('markmap-lib库未正确加载，请刷新页面重试');
                }
                
                console.log('开始解构markmap对象...');
                const { Markmap, loadCSS, loadJS } = window.markmap;
                console.log('开始解构markmapLib对象...');
                const { Transformer } = window.markmapLib;
                
                console.log('创建Transformer实例并转换Markdown...');
                // 转换Markdown为思维导图数据
                const transformer = new Transformer();
                const { root, features } = transformer.transform(markdown);
                
                // 加载必要的CSS和JS
                if (features.katex) {
                    console.log('加载KaTeX资源...');
                    loadCSS('https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.css');
                    loadJS('https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.js');
                }
                
                console.log('创建Markmap实例...');
                // 创建markmap实例
                markmapInstance = Markmap.create(svg, {
                    autoFit: true,
                    maxWidth: 300,
                }, root);
                
                // 添加工具栏
                console.log('添加工具栏...');
                if (!window.markmapToolbar) {
                    console.warn('markmapToolbar不存在，跳过工具栏添加');
                } else {
                    try {
                        const { Toolbar } = window.markmapToolbar;
                        const toolbar = new Toolbar();
                        toolbar.attach(markmapInstance);
                        console.log('工具栏添加成功');
                    } catch (toolbarError) {
                        console.error('添加工具栏时出错:', toolbarError);
                        // 工具栏添加失败不影响主要功能，继续执行
                    }
                }
                
                console.log('思维导图生成成功');
                // 隐藏加载指示器
                loadingIndicator.style.display = 'none';
            } catch (error) {
                console.error('生成思维导图时出错:', error);
                
                // 详细记录错误信息
                console.error('错误详情:', {
                    '错误消息': error.message,
                    '错误堆栈': error.stack,
                    'd3存在': typeof d3 !== 'undefined',
                    'markmap存在': typeof window.markmap !== 'undefined',
                    'markmapLib存在': typeof window.markmapLib !== 'undefined',
                    'markmapToolbar存在': typeof window.markmapToolbar !== 'undefined'
                });
                
                // 根据错误类型提供更具体的提示
                let errorMessage = '生成思维导图时出错: ' + error.message;
                
                if (error.message.includes('markmap库未正确加载')) {
                    errorMessage += '\n\n可能的解决方法:\n1. 刷新页面\n2. 清除浏览器缓存\n3. 尝试使用不同的浏览器\n4. 检查网络连接';
                } else if (error.message.includes('undefined')) {
                    errorMessage += '\n\n这可能是由于JavaScript库加载不完整导致的。请尝试刷新页面或清除浏览器缓存。';
                }
                
                alert(errorMessage);
                loadingIndicator.style.display = 'none';
            }
        }, 100);
    }

    // 清空编辑器
    function clearEditor() {
        editor.value = '';
        editor.focus();
    }

    // 保存为SVG
    function saveSvg() {
        if (!markmapInstance) {
            alert('请先生成思维导图');
            return;
        }
        
        try {
            // 获取SVG内容
            const svgElement = mindmapContainer.querySelector('svg');
            const svgContent = new XMLSerializer().serializeToString(svgElement);
            
            // 创建Blob对象
            const blob = new Blob([svgContent], { type: 'image/svg+xml' });
            
            // 创建下载链接
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'mindmap_' + new Date().toISOString().slice(0, 10) + '.svg';
            
            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('保存SVG时出错:', error);
            alert('保存SVG时出错: ' + error.message);
        }
    }

    // 加载示例
    window.loadExample = function(type) {
        if (examples[type]) {
            editor.value = examples[type];
            generateMindmap();
        }
    };

    // 初始化应用
    init();
}

// 在DOM加载完成后自动初始化应用
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，自动初始化应用...');
    window.initApp();
});