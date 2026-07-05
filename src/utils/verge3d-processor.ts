// ===== 共用文件（内嵌，无需外部文件） =====

export const MARKER_DRAG_JS = `/**
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
        markerObjects.x = app.scene.getObjectByName('\\u6807\\u8BB0X');
        markerObjects.y = app.scene.getObjectByName('\\u6807\\u8BB0Y');
        markerObjects.z = app.scene.getObjectByName('\\u6807\\u8BB0Z');
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
        if (hit.length > 0) { const o = hit[0].object; if (o.name==='\\u6807\\u8BB0X') return {axis:'x',point:hit[0].point}; if (o.name==='\\u6807\\u8BB0Y') return {axis:'y',point:hit[0].point}; if (o.name==='\\u6807\\u8BB0Z') return {axis:'z',point:hit[0].point}; }
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

export const ANNOTATION_JS = `/**
 * annotation.js - Verge3D 标注显示/隐藏通信桥
 */
(function() {
    'use strict';
    var appRef = null;
    var annotationMap = {};
    window.setupAnnotationBridge = function(app) {
        appRef = app;
        if (!app || !app.scene) { console.error('[Annotation] setupAnnotationBridge: app/scene is null'); return; }
        console.log('[Annotation] Bridge initialized');
        app.scene.children.forEach(function(child) {
            if (child.type === 'Group' && child.name && child.name.startsWith('Annotation_')) {
                var id = child.name.replace('Annotation_', '');
                annotationMap[id] = child;
                child.visible = false;
                console.log('[Annotation] Found: ' + child.name);
            }
        });
        app.ExternalInterface.showAnnotation = function(id) {
            if (annotationMap[id]) {
                annotationMap[id].visible = true;
                annotationMap[id].frustumCulled = true;
            }
        };
        app.ExternalInterface.hideAnnotation = function(id) {
            if (annotationMap[id]) { annotationMap[id].visible = false; }
        };
        app.ExternalInterface.hideAllAnnotations = function() {
            Object.keys(annotationMap).forEach(function(k) { annotationMap[k].visible = false; });
        };
        app.ExternalInterface.getAnnotationList = function() {
            return Object.keys(annotationMap);
        };
    };
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'showAnnotation') {
            if (appRef && appRef.ExternalInterface && appRef.ExternalInterface.showAnnotation) {
                appRef.ExternalInterface.showAnnotation(event.data.id);
            }
        }
        if (event.data && event.data.type === 'hideAnnotation') {
            if (appRef && appRef.ExternalInterface && appRef.ExternalInterface.hideAnnotation) {
                appRef.ExternalInterface.hideAnnotation(event.data.id);
            }
        }
    });
})();`;

// ===== 模板 =====

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
.loader-ring-bg { stroke: rgba(255,255,255,0.1); }
.loader-ring-fill { stroke: #fff; stroke-dasharray: 326.73; stroke-dashoffset: 326.73; transition: stroke-dashoffset 0.15s ease-out; }
.loader-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-family: -apple-system, sans-serif; font-size: 20px; font-weight: 300; color: rgba(255,255,255,0.8); letter-spacing: 1px; user-select: none; }
a[href*="soft8soft"] { display: none !important; }
* { -webkit-tap-highlight-color: rgba(0,0,0,0); }`;

const RING_PRELOADER_JS = `
function createRingPreloader() {
    var e = document.getElementById('custom-preloader');
    if (!e) return new v3d.Preloader();
    var t = e.querySelector('.loader-ring-fill');
    var n = e.querySelector('.loader-text');
    var i = 326.73;
    return new (class extends v3d.Preloader {
        onUpdate(e) { var r = i - (e / 100) * i; t && (t.style.strokeDashoffset = r); n && (n.textContent = Math.round(e) + '%'); }
        onFinish() { n && (n.textContent = '100%'); t && (t.style.strokeDashoffset = 0); e && (e.classList.add('fade-out'), setTimeout(function() { e.parentNode && e.parentNode.removeChild(e) }, 500)); }
    })();
}`;

// ===== 处理函数 =====

/** 处理 HTML */
export function processHtml(html: string, projectName: string): string {
  let r = html;
  r = r.replace(/^\s*<!-- __V3D_.*?-->\r?$/gm, "");
  r = r.replace('<html lang="en">', '<html lang="zh-CN">');
  r = r.replace(/<title>.*?<\/title>/, `<title>3D 展示 - ${projectName}</title>`);
  r = r.replace(/<!-- Search Engines -->[\s\S]*?(?=<script)/, "");
  r = r.replace(/<!-- (Twitter|Open Graph) -->[\s\S]*?(?=<script)/g, "");
  r = r.replace(/<!-- favicons -->[\s\S]*?(?=<script)/, "");
  r = r.replace(/<meta[^>]*soft8soft[^>]*>/gi, "");
  r = r.replace(/<div id="v3d-container">[\s\S]*?<\/div>\s*<\/div>/, '<div id="v3d-container"></div>');
  r = r.replace(
    '<script src="v3d.js"></script>',
    '<script src="v3d.js"></script>\n  <script src="marker-drag.js"></script>\n  <script src="annotation.js"></script>'
  );
  r = r.replace(/(<script\s+src=")(?!v3d\.js|marker-drag\.js|annotation\.js)([^"]*\.js)(">)/, `$1$2?v=${Date.now()}$3`);
  r = r.replace("<body>", `<body>\n${PRELOADER_HTML}`);
  return r;
}

/** 处理 CSS */
export function processCss(css: string): string {
  let r = css;
  r = r.replace(/\.fullscreen-button[\s\S]*?\n\}/g, "");
  r = r.replace(/\.fullscreen-open[\s\S]*?\n\}/g, "");
  r = r.replace(/\.fullscreen-close[\s\S]*?\n\}/g, "");
  if (!r.includes("custom-preloader")) r += PRELOADER_CSS;
  return r;
}

/** 处理 JS */
export function processJs(js: string): string {
  let r = js;
  r = r.replace(/fsButtonId:\s*'fullscreen-button'/, "fsButtonId: null");
  r = r.replace(/function prepareFullscreen[\s\S]*?function prepareExternalInterface/, "function prepareExternalInterface");
  r = r.replace(/const disposeFullscreen\s*=\s*prepareFullscreen.*?$/m, "");
  r = r.replace(/^\s+initOptions\.useFullscreen\);\r?$/m, "");
  r = r.replace(/^\s*app\.addEventListener\(.*?dispose.*$/m, "");
  r = r.replace(/new v3d\.SimplePreloader\(\{ container: containerId \}\)/, "createRingPreloader()");
  r = r.replace(/const preloader = initOptions\.useCustomPreloader\s*\?[\s\S]*?\: createRingPreloader\(\)/g, "const preloader = createRingPreloader()");

  if (!r.includes("function createRingPreloader")) {
    r = r.replace(/function createAppInstance/, `${RING_PRELOADER_JS}\n\nfunction createAppInstance`);
  }
  if (!r.includes("setupDraggableMarker")) {
    const DRAG_INIT = `\n        const drag = setupDraggableMarker(app);\n        app.ExternalInterface.resetMarkerPosition = function() { drag.resetPosition(); };\n        app.ExternalInterface.getMarkerPosition = function() { var m = drag.getMarker(); return m ? { x: m.x, y: m.y, z: m.z } : null; };`;
    r = r.replace(/runCode\(app, PL\);/g, `${DRAG_INIT}\n        runCode(app, PL);`);
  }
  if (!r.includes("setupAnnotationBridge")) {
    const ANN_INIT = `\n        (function() {\n            function init() {\n                if (!app || !app.scene || !app.scene.children.length) { setTimeout(init, 500); return; }\n                if (typeof setupAnnotationBridge === 'function') setupAnnotationBridge(app);\n            }\n            init();\n        })();`;
    r = r.replace(/runCode\(app, PL\);/g, `${ANN_INIT}\n        runCode(app, PL);`);
  }
  return r;
}

/** 判断文件是否应被跳过 */
export function shouldSkip(name: string, excludeImages = true): boolean {
  const skipDirs = ["media", "v3d_app_data"];
  // 检查是否在跳过目录内（路径任何片段匹配都跳过）
  const segments = name.replace(/\\/g, "/").toLowerCase().split("/");
  for (const seg of segments) {
    if (skipDirs.includes(seg)) return true;
  }
  // 按扩展名跳过
  const skipExts = [".blend", ".blend1", ".xml", ".bin", ".hdr", ".gltf"];
  if (excludeImages) skipExts.push(".png", ".jpg");
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext && skipExts.includes(`.${ext}`)) return true;
  return false;
}

/** 判断是否为文本文件（需要处理） */
export function isTextFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase();
  return [".html", ".htm", ".css", ".js", ".json"].some((e) => `.${ext}` === e);
}

/** 文件类型分类 */
export type FileCategory = "html" | "css" | "js" | "other" | "skip";
export function categorizeFile(name: string, excludeImages = true): FileCategory {
  if (shouldSkip(name, excludeImages)) return "skip";
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "css") return "css";
  if (ext === "js" && name !== "v3d.js") return "js";
  return "other";
}
