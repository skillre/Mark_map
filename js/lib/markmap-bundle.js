// markmap-bundle.js
// 这个文件包含了markmap所需的所有库的捆绑版本
// 用于在CDN加载失败时作为备用

// 检查是否已经加载了相关库
if (typeof d3 === 'undefined' || 
    typeof window.markmap === 'undefined' || 
    typeof window.markmapLib === 'undefined' || 
    typeof window.markmapToolbar === 'undefined') {
    
    console.log('使用本地备份的markmap库...');
    
    // 加载本地备份库的代码
    // 注意：实际部署时，应该将CDN上的库文件下载并放在这里
    // 由于文件大小限制，这里只提供一个占位符
    
    console.warn('本地备份库尚未实现，请手动下载以下文件并放置在js/lib目录下：');
    console.warn('1. d3.min.js - 从 https://cdn.jsdelivr.net/npm/d3@6.7.0');
    console.warn('2. markmap-lib.min.js - 从 https://cdn.jsdelivr.net/npm/markmap-lib@0.14.4/dist/browser/index.min.js');
    console.warn('3. markmap-view.min.js - 从 https://cdn.jsdelivr.net/npm/markmap-view@0.14.4');
    console.warn('4. markmap-toolbar.min.js - 从 https://cdn.jsdelivr.net/npm/markmap-toolbar@0.14.4/dist/index.umd.min.js');
    
    // 提示用户
    alert('无法加载markmap库。请检查网络连接或联系网站管理员。');
}