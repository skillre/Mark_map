// markmap-bundle.js
// 这个文件包含了markmap所需的所有库的基本功能
// 用于在CDN加载失败时作为备用

// 检查是否已经加载了相关库
if (typeof d3 === 'undefined' || 
    typeof window.markmap === 'undefined' || 
    typeof window.markmapLib === 'undefined' || 
    typeof window.markmapToolbar === 'undefined') {
    
    console.log('使用本地备份的markmap库...');
    console.log('当前库加载状态:', {
        'd3': typeof d3 !== 'undefined',
        'markmap': typeof window.markmap !== 'undefined',
        'markmapLib': typeof window.markmapLib !== 'undefined',
        'markmapToolbar': typeof window.markmapToolbar !== 'undefined'
    });
    
    // 创建最小化的备份库
    // 注意：这只是一个基本实现，功能有限
    
    // 如果d3未加载，创建一个最小化版本
    if (typeof d3 === 'undefined') {
        console.log('创建d3备份...');
        window.d3 = window.d3 || {};
        // 提供基本的d3功能
        window.d3.select = function(selector) {
            const elem = typeof selector === 'string' ? document.querySelector(selector) : selector;
            return {
                attr: function(name, value) { 
                    if (elem) elem.setAttribute(name, value); 
                    return this; 
                },
                append: function(tag) {
                    const newElem = document.createElementNS('http://www.w3.org/2000/svg', tag);
                    if (elem) elem.appendChild(newElem);
                    return window.d3.select(newElem);
                }
            };
        };
    }
    
    // 如果markmapLib未加载，创建一个最小化版本
    if (typeof window.markmapLib === 'undefined') {
        console.log('创建markmapLib备份...');
        window.markmapLib = window.markmapLib || {};
        window.markmapLib.Transformer = class Transformer {
            transform(markdown) {
                // 简单的Markdown解析
                const lines = markdown.split('\n');
                const root = { type: 'root', depth: 0, content: 'Root', children: [] };
                
                let currentNode = root;
                let currentDepth = 0;
                
                lines.forEach(line => {
                    if (line.startsWith('#')) {
                        const depth = line.match(/^#+/)[0].length;
                        const content = line.substring(depth).trim();
                        
                        const newNode = { type: 'heading', depth, content, children: [] };
                        
                        if (depth > currentDepth) {
                            currentNode.children.push(newNode);
                        } else {
                            let parent = root;
                            for (let i = 1; i < depth; i++) {
                                parent = parent.children[parent.children.length - 1] || parent;
                            }
                            parent.children.push(newNode);
                        }
                        
                        currentNode = newNode;
                        currentDepth = depth;
                    }
                });
                
                return { root, features: {} };
            }
        };
    }
    
    // 如果markmap未加载，创建一个最小化版本
    if (typeof window.markmap === 'undefined') {
        console.log('创建markmap备份...');
        window.markmap = window.markmap || {};
        window.markmap.Markmap = class Markmap {
            static create(svg, options, data) {
                const instance = new Markmap(svg, options);
                instance.setData(data);
                return instance;
            }
            
            constructor(svg, options) {
                this.svg = svg;
                this.options = options || {};
            }
            
            setData(data) {
                this.data = data;
                this.renderData();
            }
            
            renderData() {
                const svg = this.svg;
                if (!svg) return;
                
                // 清空SVG
                while (svg.firstChild) {
                    svg.removeChild(svg.firstChild);
                }
                
                // 添加一个文本节点，说明这是备份模式
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', '50%');
                text.setAttribute('y', '50%');
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '16px');
                text.setAttribute('fill', 'red');
                text.textContent = '备份模式：CDN加载失败，功能受限。请刷新页面或检查网络连接。';
                svg.appendChild(text);
                
                // 添加一个简单的提示，显示Markdown内容
                const desc = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                desc.setAttribute('x', '50%');
                desc.setAttribute('y', '60%');
                desc.setAttribute('text-anchor', 'middle');
                desc.setAttribute('font-size', '14px');
                desc.textContent = '请尝试刷新页面或使用不同的浏览器';
                svg.appendChild(desc);
            }
        };
        
        window.markmap.loadCSS = function() {};
        window.markmap.loadJS = function() {};
    }
    
    // 如果markmapToolbar未加载，创建一个最小化版本
    if (typeof window.markmapToolbar === 'undefined') {
        console.log('创建markmapToolbar备份...');
        window.markmapToolbar = window.markmapToolbar || {};
        window.markmapToolbar.Toolbar = class Toolbar {
            attach() {
                console.log('备份模式：工具栏功能不可用');
            }
        };
    }
    
    console.log('本地备份库加载完成，但功能受限');
    console.warn('建议：请刷新页面或检查网络连接，以获得完整功能');
}