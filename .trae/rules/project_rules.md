项目部署环境为vercel
vercel 部署项目时，需要在项目根目录下创建vercel.json文件，内容如下：
```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.html",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "handle": "filesystem"    
    }
}
```
