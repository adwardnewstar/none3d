/**
 * modified3d 本地静态文件服务器
 * 模拟 CloudBase 文件托管，用于开发环境。
 *
 * 启动方式: node serve.cjs
 * 目录结构:
 *   modified3d/
 *     dbfalse/           ← 模拟数据库文件夹（开发时模型放这里）
 *       样板中心投影模型/
 *       其他模型...
 *     共享文件/           ← 共用 JS/CSS 模板
 *
 * 特性：
 * - 自动同步 共享文件/ 到 dbfalse/ 下的各模型目录
 * - 支持 CORS（iframe 跨域）
 * - 自动打开目录列表
 */

const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = 8087
const ROOT = __dirname

// ========== 共享文件同步 ==========
const sharedDir = path.join(ROOT, '共享文件')
const modelRoot = path.join(ROOT, 'dbfalse')
const sharedFiles = ['annotation.js', 'marker-drag.js', 'template-annotation-init.txt', 'template-drag-init.txt', 'template-preloader-css.txt', 'template-preloader-html.txt', 'template-ring-preloader-js.txt']

function syncSharedFiles() {
  if (!fs.existsSync(modelRoot)) {
    console.log('  [sync] dbfalse/ 不存在，跳过')
    return
  }
  const entries = fs.readdirSync(modelRoot, { withFileTypes: true })
  let count = 0
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const modelDir = path.join(modelRoot, entry.name)
    for (const filename of sharedFiles) {
      const src = path.join(sharedDir, filename)
      const dest = path.join(modelDir, filename)
      try {
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest)
        }
      } catch (e) {
        console.error(`  [sync] 复制 ${filename} → dbfalse/${entry.name}/ 失败:`, e.message)
      }
    }
    count++
  }
  console.log(`  [sync] 共享文件已同步到 dbfalse/ 下 ${count} 个模型目录`)
}

console.log('[serve] 正在同步共享文件...')
syncSharedFiles()

// ========== MIME 类型 ==========
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.wasm': 'application/wasm',
  '.bin':  'application/octet-stream',
  '.gltf': 'model/gltf+json',
  '.ktx2': 'image/ktx2',
  '.hdr':  'application/octet-stream',
  '.xz':   'application/x-xz',
}

// ========== HTTP 服务 ==========
const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // 解析路径，防止目录遍历
  let reqPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname)
  const safePath = path.normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, '')
  let filePath = path.join(ROOT, safePath)

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('404 Not Found: ' + reqPath)
      return
    }

    if (stats.isDirectory()) {
      // 默认找 index.html，没有则列出目录
      const indexPath = path.join(filePath, 'index.html')
      fs.stat(indexPath, (err2, stats2) => {
        if (!err2 && stats2.isFile()) {
          serveFile(indexPath, res)
        } else {
          // 找该目录下的 .html 作为入口
          fs.readdir(filePath, (err3, files) => {
            if (err3) {
              res.writeHead(500)
              res.end('Server Error')
              return
            }
            const htmlFiles = files.filter(f => f.endsWith('.html'))
            if (htmlFiles.length === 0) {
              // 无 HTML 文件，403
              res.writeHead(403)
              res.end('Forbidden')
              return
            }
            // 重定向到第一个 .html（URL 需要编码）
            const redirect = (reqPath.endsWith('/') ? reqPath : reqPath + '/') + htmlFiles[0]
            res.writeHead(302, { Location: encodeURI(redirect) })
            res.end()
          })
        }
      })
    } else {
      serveFile(filePath, res)
    }
  })
})

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase()
  const contentType = MIME[ext] || 'application/octet-stream'

  // 为 .html 注入 cache-control: no-cache（开发时方便）
  const headers = {
    'Content-Type': contentType,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'max-age=0, must-revalidate',
  }

  // 大文件用流
  const stream = fs.createReadStream(filePath)
  stream.on('open', () => {
    res.writeHead(200, headers)
    stream.pipe(res)
  })
  stream.on('error', () => {
    res.writeHead(500)
    res.end('Server Error')
  })
}

server.listen(PORT, () => {
  console.log(`\n  ✅ modified3d 静态服务已启动:`)
  console.log(`  http://localhost:${PORT}`)
  console.log(`  ${ROOT}\n`)
})
