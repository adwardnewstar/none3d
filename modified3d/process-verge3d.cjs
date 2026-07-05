/**
 * process-verge3d.js - Verge3D 项目本地处理脚本
 *
 * 用法:
 *   node process-verge3d.js <项目文件夹路径> [输出zip路径]
 *
 * 示例:
 *   node process-verge3d.js "D:\微信存储\牛家兴工作\verge3d\样板中心投影模型"
 *   node process-verge3d.js "D:\微信存储\牛家兴工作\verge3d\样板中心投影模型" "C:\output\myproject.zip"
 *
 * 功能:
 *   1. 复制项目文件（排除 media/v3d_app_data/.blend/.blend1/.xml）
 *   2. 修改 HTML（标题/语言/预加载/水印/脚本注入）
 *   3. 修改 CSS（移除全屏按钮/注入预加载样式）
 *   4. 修改 JS（禁用全屏/替换加载动画/注入拖拽/注入标注）
 *   5. 复制共用文件（marker-drag.js / annotation.js）
 *   6. 打包为 .zip 文件
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

// ===== 模板内容（内嵌，无需外部文件） =====

const PRELOADER_HTML = `  <div id="custom-preloader">
    <div class="loader-container">
      <svg class="loader-ring" viewBox="0 0 120 120" width="120" height="120">
        <circle class="loader-ring-bg" cx="60" cy="60" r="52" fill="none" stroke-width="4"/>
        <circle class="loader-ring-fill" cx="60" cy="60" r="52" fill="none" stroke-width="4"
          transform="rotate(-90 60 60)" stroke-linecap="round"/>
      </svg>
      <span class="loader-text">0%</span>
    </div>
  </div>`;

const PRELOADER_CSS = `
#custom-preloader {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: #1a1a1a; display: flex; align-items: center; justify-content: center;
    z-index: 9999; transition: opacity 0.5s ease;
}
#custom-preloader.fade-out { opacity: 0; pointer-events: none; }
.loader-container { position: relative; display: flex; align-items: center; justify-content: center; }
.loader-ring-bg { stroke: rgba(255, 255, 255, 0.1); }
.loader-ring-fill { stroke: #ffffff; stroke-dasharray: 326.73; stroke-dashoffset: 326.73; transition: stroke-dashoffset 0.15s ease-out; }
.loader-text { position: absolute; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 20px; font-weight: 300; color: rgba(255, 255, 255, 0.8); letter-spacing: 1px; user-select: none; }
a[href*="soft8soft"] { display: none !important; }
* { -webkit-tap-highlight-color:rgba(0,0,0,0); }`;

const RING_PRELOADER_JS = `
function createRingPreloader() {
    const preloaderEl = document.getElementById('custom-preloader');
    if (!preloaderEl) return new v3d.Preloader();
    const ringFill = preloaderEl.querySelector('.loader-ring-fill');
    const textEl = preloaderEl.querySelector('.loader-text');
    const circumference = 326.73;
    class RingPreloader extends v3d.Preloader {
        onUpdate(percentage) {
            const offset = circumference - (percentage / 100) * circumference;
            if (ringFill) ringFill.style.strokeDashoffset = offset;
            if (textEl) textEl.textContent = Math.round(percentage) + '%';
        }
        onFinish() {
            if (textEl) textEl.textContent = '100%';
            if (ringFill) ringFill.style.strokeDashoffset = 0;
            if (preloaderEl) {
                preloaderEl.classList.add('fade-out');
                setTimeout(function() {
                    if (preloaderEl.parentNode) preloaderEl.parentNode.removeChild(preloaderEl);
                }, 500);
            }
        }
    }
    return new RingPreloader();
}`;

const DRAG_INIT_CODE = `
        const drag = setupDraggableMarker(app);
        app.ExternalInterface.resetMarkerPosition = function() {
            drag.resetPosition();
        };
        app.ExternalInterface.getMarkerPosition = function() {
            const m = drag.getMarker();
            return m ? { x: m.x, y: m.y, z: m.z } : null;
        };`;

const ANNOTATION_INIT_CODE = `
        (function() {
            function initAnnotation() {
                if (!app || !app.scene || !app.scene.children.length) {
                    setTimeout(initAnnotation, 500);
                    return;
                }
                if (typeof setupAnnotationBridge === 'function') {
                    setupAnnotationBridge(app);
                }
            }
            initAnnotation();
        })();`;

// marker-drag.js 和 annotation.js 共用文件内容
const MARKER_DRAG_JS = `/**
 * marker-drag.js - Verge3D 标记物体轴约束拖拽功能（共用函数）
 */
function setupDraggableMarker(app) {
    const STORAGE_KEY = 'v3d_marker_position';
    const domElement = app.renderer.domElement;
    let markerObjects = { x: null, y: null, z: null };
    let activeAxis = null;
    let isDragging = false;
    let dragPlane = new v3d.Plane();
    let groupStartPos = new v3d.Vector3();
    let hitPoint = new v3d.Vector3();
    let raycaster = new v3d.Raycaster();
    let mouse = new v3d.Vector2();
    let capturedPointerId = null;
    let viewBounds = null;
    function findMarkers() {
        markerObjects.x = app.scene.getObjectByName('标记X');
        markerObjects.y = app.scene.getObjectByName('标记Y');
        markerObjects.z = app.scene.getObjectByName('标记Z');
        if (markerObjects.x && markerObjects.y && markerObjects.z) {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) { try { const pos = JSON.parse(saved); setAllPositions(pos.x, pos.y, pos.z); } catch(e) {} }
        } else { setTimeout(findMarkers, 1000); }
    }
    function setAllPositions(x, y, z) {
        if (markerObjects.x) markerObjects.x.position.set(x, y, z);
        if (markerObjects.y) markerObjects.y.position.set(x, y, z);
        if (markerObjects.z) markerObjects.z.position.set(x, y, z);
    }
    function getGroupPosition() { return markerObjects.x ? markerObjects.x.position.clone() : new v3d.Vector3(); }
    if (app.scene) { findMarkers(); } else {
        var checkTimer = setInterval(function() { if (app.scene) { clearInterval(checkTimer); findMarkers(); } }, 200);
    }
    function getPointerNDC(e) {
        const rect = domElement.getBoundingClientRect();
        return { x: ((e.clientX||e.pageX)-rect.left)/rect.width*2-1, y: -((e.clientY||e.pageY)-rect.top)/rect.height*2+1 };
    }
    function hitTestAxis(ndc) {
        const targets = []; if (markerObjects.x) targets.push(markerObjects.x); if (markerObjects.y) targets.push(markerObjects.y); if (markerObjects.z) targets.push(markerObjects.z);
        if (!targets.length) return null; mouse.set(ndc.x, ndc.y); raycaster.setFromCamera(mouse, app.camera);
        const hit = raycaster.intersectObjects(targets, false);
        if (hit.length > 0) { const o = hit[0].object; if (o.name==='标记X') return {axis:'x',point:hit[0].point}; if (o.name==='标记Y') return {axis:'y',point:hit[0].point}; if (o.name==='标记Z') return {axis:'z',point:hit[0].point}; }
        return null;
    }
    function onPointerDownCapture(e) {
        if (!markerObjects.x||!markerObjects.y||!markerObjects.z) return; const ndc=getPointerNDC(e); const hit=hitTestAxis(ndc); if(!hit)return;
        e.stopPropagation(); e.preventDefault(); domElement.setPointerCapture(e.pointerId); capturedPointerId=e.pointerId;
        isDragging=true; activeAxis=hit.axis; domElement.style.cursor='grabbing'; if(app.controls)app.controls.enabled=false;
        groupStartPos.copy(getGroupPosition()); hitPoint.copy(hit.point);
        const refDist=hitPoint.distanceTo(app.camera.position); const fovRad=app.camera.fov*Math.PI/180; const halfHeight=refDist*Math.tan(fovRad/2); const halfWidth=halfHeight*app.camera.aspect;
        viewBounds={yMin:0,yMax:halfHeight*0.9,xMax:halfWidth*0.9,zMax:halfWidth*0.9};
    }
    function getAxisDir() { if(activeAxis==='x')return new v3d.Vector3(1,0,0); if(activeAxis==='y')return new v3d.Vector3(0,0,1); if(activeAxis==='z')return new v3d.Vector3(0,1,0); return new v3d.Vector3(); }
    function getAxisSign() { return -1; }
    function onPointerMoveCapture(e) {
        if(!isDragging||!activeAxis)return; e.stopPropagation(); e.preventDefault(); const ndc=getPointerNDC(e); mouse.set(ndc.x,ndc.y); raycaster.setFromCamera(mouse,app.camera);
        const axisDir=getAxisDir(); const rayOrigin=raycaster.ray.origin; const rayDir=raycaster.ray.direction;
        const cross1=new v3d.Vector3().crossVectors(rayDir,axisDir); const denom=cross1.dot(cross1); if(denom<0.0001)return;
        const w=new v3d.Vector3().copy(rayOrigin).sub(hitPoint); const cross2=new v3d.Vector3().crossVectors(rayDir,cross1); const t=w.dot(cross2)/denom; const sign=getAxisSign();
        const newPos=groupStartPos.clone(); if(activeAxis==='x')newPos.x=groupStartPos.x+t*sign; else if(activeAxis==='y')newPos.z=groupStartPos.z+t*sign; else if(activeAxis==='z')newPos.y=groupStartPos.y+t*sign;
        if(viewBounds){newPos.y=Math.max(viewBounds.yMin,Math.min(newPos.y,viewBounds.yMax));newPos.x=Math.max(-viewBounds.xMax,Math.min(newPos.x,viewBounds.xMax));newPos.z=Math.max(-viewBounds.zMax,Math.min(newPos.z,viewBounds.zMax));}
        setAllPositions(newPos.x,newPos.y,newPos.z);
    }
    function onPointerUpCapture(e) {
        if(!isDragging)return; if(capturedPointerId!==null){try{domElement.releasePointerCapture(capturedPointerId)}catch(_){}} capturedPointerId=null;
        isDragging=false; activeAxis=null; domElement.style.cursor='default'; if(app.controls)app.controls.enabled=true; const pos=getGroupPosition(); localStorage.setItem(STORAGE_KEY,JSON.stringify({x:pos.x,y:pos.y,z:pos.z}));
    }
    domElement.addEventListener('pointerdown',onPointerDownCapture,true); domElement.addEventListener('pointermove',onPointerMoveCapture,true); domElement.addEventListener('pointerup',onPointerUpCapture,true);
    domElement.addEventListener('pointerleave',function(e){if(!isDragging)return; if(capturedPointerId!==null){try{domElement.releasePointerCapture(capturedPointerId)}catch(_){}} capturedPointerId=null; isDragging=false; activeAxis=null; domElement.style.cursor='default'; if(app.controls)app.controls.enabled=true;});
    return { getMarker:function(){return getGroupPosition();}, resetPosition:function(){setAllPositions(0,0,0);localStorage.removeItem(STORAGE_KEY);} };
}`;

const ANNOTATION_JS = fs.readFileSync(
  path.join(__dirname, "共享文件", "annotation.js"),
  "utf-8"
);

// ===== 工具函数 =====

/** 判断文件是否应被跳过 */
function shouldSkip(name) {
  const skipDirs = ["media", "v3d_app_data"];
  const skipPatterns = [/\.blend$/i, /\.blend1$/i, /\.xml$/i];
  if (skipDirs.includes(name.toLowerCase())) return true;
  for (const p of skipPatterns) {
    if (p.test(name)) return true;
  }
  return false;
}

/** 判断文件是否为文本文件 */
function isTextFile(name) {
  const ext = path.extname(name).toLowerCase();
  return [".html", ".htm", ".css", ".js", ".json"].includes(ext);
}

/** 从目录名推断项目名称 */
function getProjectName(srcDir) {
  return path.basename(path.resolve(srcDir));
}

// ===== 处理函数 =====

/** 处理 HTML 文件 */
function processHtml(html, projectName) {
  let result = html;

  // 1. 移除 Verge3D 注释行
  result = result.replace(/^\s*<!-- __V3D_.*?-->\r?$/gm, "");

  // 2. 改 lang
  result = result.replace('<html lang="en">', '<html lang="zh-CN">');

  // 3. 替换标题
  result = result.replace(
    /<title>.*?<\/title>/,
    `<title>3D 展示 - ${projectName}</title>`
  );

  // 4. 移除 SEO / Open Graph / Twitter / favicons
  result = result.replace(/<!-- Search Engines -->[\s\S]*?(?=<script)/, "");
  result = result.replace(
    /<!-- (Twitter|Open Graph) -->[\s\S]*?(?=<script)/g,
    ""
  );
  result = result.replace(/<!-- favicons -->[\s\S]*?(?=<script)/, "");

  // 5. 移除 soft8soft meta
  result = result.replace(/<meta[^>]*soft8soft[^>]*>/gi, "");

  // 6. 清理 v3d-container
  result = result.replace(
    /<div id="v3d-container">[\s\S]*?<\/div>\s*<\/div>/,
    '<div id="v3d-container"></div>'
  );

  // 7. 在 v3d.js 之后注入 marker-drag.js 和 annotation.js
  result = result.replace(
    '<script src="v3d.js"></script>',
    '<script src="v3d.js"></script>\n  <script src="marker-drag.js"></script>\n  <script src="annotation.js"></script>'
  );

  // 8. 给主 JS 添加缓存破坏参数
  result = result.replace(
    /(<script\s+src=")(?!v3d\.js|marker-drag\.js|annotation\.js)([^"]*\.js)(")/,
    `$1$2?v=${Date.now()}$3`
  );

  // 9. 插入 preloader
  result = result.replace("<body>", `<body>\n${PRELOADER_HTML}`);

  return result;
}

/** 处理 CSS 文件 */
function processCss(css) {
  let result = css;

  // 移除全屏按钮样式
  result = result.replace(/\.fullscreen-button[\s\S]*?\n\}/g, "");
  result = result.replace(/\.fullscreen-open[\s\S]*?\n\}/g, "");
  result = result.replace(/\.fullscreen-close[\s\S]*?\n\}/g, "");

  // 追加 preloader CSS
  if (!result.includes("custom-preloader")) {
    result += PRELOADER_CSS;
  }

  return result;
}

/** 处理 JS 文件 */
function processJs(js) {
  let result = js;

  // 1. 禁用全屏按钮
  result = result.replace(
    /fsButtonId:\s*'fullscreen-button'/,
    "fsButtonId: null"
  );

  // 2. 移除 prepareFullscreen 函数
  result = result.replace(
    /function prepareFullscreen[\s\S]*?function prepareExternalInterface/,
    "function prepareExternalInterface"
  );

  // 3. 移除 disposeFullscreen
  result = result.replace(
    /const disposeFullscreen\s*=\s*prepareFullscreen.*?$/m,
    ""
  );

  // 4. 移除 initOptions.useFullscreen
  result = result.replace(/^\s+initOptions\.useFullscreen\);\r?$/m, "");

  // 5. 移除 app.addEventListener dispose
  result = result.replace(/^\s*app\.addEventListener\(.*?dispose.*$/m, "");

  // 6. 替换 SimplePreloader → createRingPreloader
  result = result.replace(
    /new v3d\.SimplePreloader\(\{ container: containerId \}\)/,
    "createRingPreloader()"
  );
  result = result.replace(
    /const preloader = initOptions\.useCustomPreloader\s*\?[\s\S]*?\: createRingPreloader\(\)/g,
    "const preloader = createRingPreloader()"
  );

  // 7. 注入 createRingPreloader 函数
  if (!result.includes("function createRingPreloader")) {
    result = result.replace(
      /function createAppInstance/,
      `${RING_PRELOADER_JS}\n\nfunction createAppInstance`
    );
  }

  // 8. 注入拖拽初始化代码
  if (!result.includes("setupDraggableMarker")) {
    result = result.replace(
      /runCode\(app, PL\);/,
      `${DRAG_INIT_CODE}\n        runCode(app, PL);`
    );
  }

  // 9. 注入标注初始化代码
  if (!result.includes("setupAnnotationBridge")) {
    result = result.replace(
      /runCode\(app, PL\);/,
      `${ANNOTATION_INIT_CODE}\n        runCode(app, PL);`
    );
  }

  return result;
}

// ===== 主流程 =====

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("用法: node process-verge3d.js <项目文件夹路径> [输出zip路径]");
    process.exit(1);
  }

  const srcDir = path.resolve(args[0]);
  const projectName = getProjectName(srcDir);
  const defaultZipPath = path.join(
    path.dirname(srcDir),
    `${projectName}-processed.zip`
  );
  const zipPath = path.resolve(args[1] || defaultZipPath);

  if (!fs.existsSync(srcDir)) {
    console.error(`错误: 源目录不存在: ${srcDir}`);
    process.exit(1);
  }

  console.log("=== Verge3D 项目处理脚本 ===");
  console.log(`项目: ${projectName}`);
  console.log(`源目录: ${srcDir}`);
  console.log(`输出: ${zipPath}`);

  // 创建临时输出目录
  const tmpDir = path.join(os.tmpdir(), `verge3d-${projectName}-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // [1/5] 复制文件
    console.log("[1/5] 复制项目文件...");
    const entries = fs.readdirSync(srcDir);
    for (const entry of entries) {
      if (shouldSkip(entry)) {
        console.log(`  跳过: ${entry}`);
        continue;
      }
      const srcPath = path.join(srcDir, entry);
      const dstPath = path.join(tmpDir, entry);
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        copyDirSync(srcPath, dstPath);
      } else {
        fs.copyFileSync(srcPath, dstPath);
      }
    }

    // [2/5] 修改 HTML
    console.log("[2/5] 修改 HTML...");
    const htmlFiles = fs.readdirSync(tmpDir).filter((f) => /\.html?$/i.test(f));
    for (const htmlFile of htmlFiles) {
      const htmlPath = path.join(tmpDir, htmlFile);
      const html = fs.readFileSync(htmlPath, "utf-8");
      const processed = processHtml(html, projectName);
      fs.writeFileSync(htmlPath, processed, "utf-8");
      console.log(`  处理: ${htmlFile}`);
    }

    // [3/5] 修改 CSS
    console.log("[3/5] 修改 CSS...");
    const cssFiles = fs.readdirSync(tmpDir).filter((f) => /\.css$/i.test(f));
    for (const cssFile of cssFiles) {
      const cssPath = path.join(tmpDir, cssFile);
      const css = fs.readFileSync(cssPath, "utf-8");
      const processed = processCss(css);
      fs.writeFileSync(cssPath, processed, "utf-8");
      console.log(`  处理: ${cssFile}`);
    }

    // [4/5] 修改 JS
    console.log("[4/5] 修改 JS...");
    const jsFiles = fs
      .readdirSync(tmpDir)
      .filter((f) => /\.js$/i.test(f) && f !== "v3d.js");
    for (const jsFile of jsFiles) {
      const jsPath = path.join(tmpDir, jsFile);
      const js = fs.readFileSync(jsPath, "utf-8");
      const processed = processJs(js);
      fs.writeFileSync(jsPath, processed, "utf-8");
      console.log(`  处理: ${jsFile}`);
    }

    // [5/5] 复制共用文件 + 打包
    console.log("[5/5] 复制共用文件 & 打包...");
    // marker-drag.js
    fs.writeFileSync(path.join(tmpDir, "marker-drag.js"), MARKER_DRAG_JS, "utf-8");
    console.log("  注入: marker-drag.js");
    // annotation.js
    fs.writeFileSync(path.join(tmpDir, "annotation.js"), ANNOTATION_JS, "utf-8");
    console.log("  注入: annotation.js");

    // 打包为 zip（使用 PowerShell Compress-Archive）
    console.log(`  打包: ${zipPath}`);
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    try {
      execSync(
        `powershell -NoProfile -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: "pipe" }
      );
    } catch (e) {
      console.error("  打包失败，尝试备用方案...");
      // 备用方案：直接用 PowerShell 压缩到脚本目录
      const fallbackZip = path.join(
        __dirname,
        `${projectName}-processed.zip`
      );
      execSync(
        `powershell -NoProfile -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${fallbackZip}' -Force"`,
        { stdio: "pipe" }
      );
      console.log(`  已输出到: ${fallbackZip}`);
    }

    console.log("\n完成!");
    console.log(`输出文件: ${zipPath}`);
    console.log(`处理文件数: ${fs.readdirSync(tmpDir).length}`);
  } finally {
    // 清理临时目录
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {
      // 忽略清理错误
    }
  }
}

/** 递归复制目录 */
function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src);
  for (const entry of entries) {
    const srcPath = path.join(src, entry);
    const dstPath = path.join(dst, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirSync(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

main();
