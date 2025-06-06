import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="zh">
      <Head>
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234a90e2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6'%3E%3C/polygon%3E%3Cline x1='8' y1='2' x2='8' y2='18'%3E%3C/line%3E%3Cline x1='16' y1='6' x2='16' y2='22'%3E%3C/line%3E%3C/svg%3E" />
        <meta name="description" content="将Markdown文本转换为美观的思维导图" />
        <meta name="theme-color" content="#4a90e2" />
        <meta name="keywords" content="思维导图,Markdown,Markmap,在线思维导图,知识图谱" />
        <meta name="author" content="Markmap思维导图生成器" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
} 