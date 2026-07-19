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
    let buttonAxis = null;
    let dragPlane = new v3d.Plane();
    let groupStartPos = new v3d.Vector3();
    let hitPoint = new v3d.Vector3();
    let raycaster = new v3d.Raycaster();
    let mouse = new v3d.Vector2();
    let capturedPointerId = null;
    let viewBounds = null;
    let initialAxisOffset = 0;
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
        if (!markerObjects.x||!markerObjects.y||!markerObjects.z) return;
        if(buttonAxis){e.stopPropagation();e.preventDefault();domElement.setPointerCapture(e.pointerId);capturedPointerId=e.pointerId;isDragging=true;activeAxis=buttonAxis;domElement.style.cursor='grabbing';if(app.controls)app.controls.enabled=false;groupStartPos.copy(getGroupPosition());hitPoint.copy(getGroupPosition());var _ndc=getPointerNDC(e);mouse.set(_ndc.x,_ndc.y);raycaster.setFromCamera(mouse,app.camera);var _axisDir=getAxisDir();var _rayOrigin=raycaster.ray.origin;var _rayDir=raycaster.ray.direction;var _cross1=new v3d.Vector3().crossVectors(_rayDir,_axisDir);var _denom=_cross1.dot(_cross1);if(_denom>=0.0001){var _w=new v3d.Vector3().copy(_rayOrigin).sub(hitPoint);var _cross2=new v3d.Vector3().crossVectors(_rayDir,_cross1);initialAxisOffset=_w.dot(_cross2)/_denom;}else{initialAxisOffset=0;}var _rd=hitPoint.distanceTo(app.camera.position);var _fr=app.camera.fov*Math.PI/180;var _hh=_rd*Math.tan(_fr/2);var _hw=_hh*app.camera.aspect;viewBounds={yMin:0,yMax:_hh*0.9,xMax:_hw*0.9,zMax:_hw*0.9};return;}
        const ndc=getPointerNDC(e); const hit=hitTestAxis(ndc); if(!hit)return;
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
        const w=new v3d.Vector3().copy(rayOrigin).sub(hitPoint); const cross2=new v3d.Vector3().crossVectors(rayDir,cross1); const t=w.dot(cross2)/denom; const sign=getAxisSign(); const dt=t-initialAxisOffset;
        const newPos=groupStartPos.clone(); if(activeAxis==='x')newPos.x=groupStartPos.x+dt*sign; else if(activeAxis==='y')newPos.z=groupStartPos.z+dt*sign; else if(activeAxis==='z')newPos.y=groupStartPos.y+dt*sign;
        if(viewBounds){newPos.y=Math.max(viewBounds.yMin,Math.min(newPos.y,viewBounds.yMax));newPos.x=Math.max(-viewBounds.xMax,Math.min(newPos.x,viewBounds.xMax));newPos.z=Math.max(-viewBounds.zMax,Math.min(newPos.z,viewBounds.zMax));}
        setAllPositions(newPos.x,newPos.y,newPos.z);
    }
    function onPointerUpCapture(e) {
        if(!isDragging)return; if(capturedPointerId!==null){try{domElement.releasePointerCapture(capturedPointerId)}catch(_){}} capturedPointerId=null;
        isDragging=false; activeAxis=null; initialAxisOffset=0; domElement.style.cursor='default'; if(app.controls)app.controls.enabled=true; const pos=getGroupPosition(); localStorage.setItem(STORAGE_KEY,JSON.stringify({x:pos.x,y:pos.y,z:pos.z}));
    }
    domElement.addEventListener('pointerdown',onPointerDownCapture,true); domElement.addEventListener('pointermove',onPointerMoveCapture,true); domElement.addEventListener('pointerup',onPointerUpCapture,true);
    domElement.addEventListener('pointerleave',function(e){if(!isDragging)return; if(capturedPointerId!==null){try{domElement.releasePointerCapture(capturedPointerId)}catch(_){}} capturedPointerId=null; isDragging=false; activeAxis=null; initialAxisOffset=0; domElement.style.cursor='default'; if(app.controls)app.controls.enabled=true;});
    return { getMarker:function(){return getGroupPosition();}, resetPosition:function(){setAllPositions(0,0,0);localStorage.removeItem(STORAGE_KEY);}, setAxis:function(axis){buttonAxis=axis;} };
};`;

export const ANNOTATION_JS = `/**
 * annotation.js - Verge3D 场景注释（Annotation）共用函数
 *
 * 与 React 父页面通过 postMessage 通信，实现：
 *   - 在场景指定坐标创建注释标签
 *   - 移动注释到新位置
 *   - 更新注释内容
 *   - 删除注释
 *   - 重建/重新编号所有注释
 *   - 启用"点击拾取坐标"模式
 *
 * Verge3D Annotation API:
 *   new v3d.Annotation(container, character, dialogContents)
 *   - container: HTMLElement (通常为 app.container)
 *   - character: 标签显示字符，如 "1", "A", "📍"
 *   - dialogContents: 点击标签后弹出的对话内容（支持 HTML）
 *   然后设置 annotation.position.set(x, y, z)
 *   再 app.scene.add(annotation)
 */
(function () {
  "use strict";

  // 存储所有活跃的 annotation，keyed by commentId
  var annotations = {};

  // 拾取模式状态
  var pickState = null;

  // ==============================
  //  CSS 注入
  // ==============================
  (function injectStyles() {
    var styleId = "annotation-custom-styles";
    if (document.getElementById(styleId)) return;

    var css = document.createElement("style");
    css.id = styleId;
    css.textContent =
      ".v3d-annotation, .v3d-annotation * {" +
      "  pointer-events: auto !important;" +
      "  z-index: 1000 !important;" +
      "}" +
      ".v3d-annotation-dialog, .annotation-dialog {" +
      "  pointer-events: auto !important;" +
      "  z-index: 1001 !important;" +
      "}" +
      "@keyframes annotationPing {" +
      "  0% { outline: 2px solid transparent; outline-offset: 2px; }" +
      "  50% { outline: 2px solid #3b82f6; outline-offset: 4px; }" +
      "  100% { outline: 2px solid transparent; outline-offset: 2px; }" +
      "}" +
      ".annotation-ping {" +
      "  animation: annotationPing 0.6s ease-in-out !important;" +
      "}" +
      ".ann-hover-card { padding: 3px; min-width: 200px; max-width: 260px; }" +
      ".ann-dialog-header { display: flex; flex-direction: column; gap: 1px; padding: 0; border-bottom: 1px solid rgba(255,255,255,0.15); margin-bottom: 4px; text-align: left; }" +
      ".ann-dialog-header-top { display: flex; align-items: center; justify-content: space-between; }" +
      ".ann-dialog-nickname { font-size: 12px; font-weight: 500; color: #e5e7eb; white-space: nowrap; }" +
      ".ann-dialog-date { font-size: 10px; color: #9ca3af; white-space: nowrap; text-align: left; }" +
      ".ann-dialog-close { margin-left: auto; background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 12px; line-height: 1; padding: 0 2px; transition: color 0.15s; }" +
      ".ann-dialog-close:hover { color: #ef4444; }" +
      ".ann-hover-content { font-size: 13px; color: #fff; text-align: left; line-height: 1.4; margin-bottom: 4px; }" +
      ".ann-hover-actions { display: flex; gap: 12px; align-items: center; }" +
      ".ann-btn { background: none; border: none; cursor: pointer; font-size: 13px; padding: 2px 4px; display: flex; align-items: center; gap: 3px; color: #666; transition: color 0.15s; }" +
      ".ann-btn:hover { color: #333; }" +
      ".ann-like:hover { color: #e74c3c; }" +
      ".ann-dislike:hover { color: #e67e22; }" +
      ".ann-reply:hover { color: #3498db; }" +
      ".ann-dialog-focus { margin-left: auto; color: #9ca3af; font-size: 16px; line-height: 1; }" +
      ".ann-dialog-focus:hover { color: #e5e7eb; }" +
      ".ann-hover-reply { margin-top: 6px; }" +
      ".ann-reply-row { display: flex; gap: 4px; }" +
      ".ann-reply-preview { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }" +
      ".ann-reply-preview-item { position: relative; display: inline-block; }" +
      ".ann-reply-preview-item img { height: 48px; width: 48px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); }" +
      ".ann-reply-preview-item .ann-reply-img-remove { position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; border-radius: 50%; background: #6b7280; color: #fff; border: none; font-size: 11px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }" +
      ".ann-reply-preview-item .ann-reply-img-remove:hover { background: #ef4444; }" +
      ".ann-reply-clip { background: none; border: none; cursor: pointer; font-size: 14px; line-height: 1; padding: 2px 4px; color: #9ca3af; transition: color 0.15s; }" +
      ".ann-reply-clip:hover { color: #e5e7eb; }" +
      ".ann-reply-input { flex: 1; border: 1px solid #ddd; border-radius: 4px; padding: 4px 8px; font-size: 12px; outline: none; }" +
      ".ann-reply-img { max-height: 64px; max-width: 100%; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); margin-top: 2px; object-fit: contain; }" +
      ".ann-reply-send { background: #3b82f6; color: white; border: none; border-radius: 4px; padding: 4px 10px; font-size: 12px; cursor: pointer; }" +
      ".ann-replies { margin: 4px 0; padding-left: 1em; }" +
      ".ann-reply-item { display: flex; flex-direction: column; gap: 2px; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; }" +
      ".ann-reply-author { color: #93c5fd; white-space: nowrap; font-weight: 500; text-align: left; }" +
        ".ann-reply-text { color: #fff; word-break: break-all; text-align: left; }" +
      ".ann-reply-actions { display: flex; gap: 6px; align-items: center; margin-top: 2px; }" +
      ".ann-reply-actions .ann-btn { font-size: 11px; padding: 1px 3px; }" +
      ".v3d-annotation-dialog { position: absolute !important; top: -1px !important; left: calc(100% + 1em) !important; margin: 0 !important; border-radius: 5px !important; border: 2px solid rgba(255,255,255,0.7) !important; overflow: hidden !important; }" +
      ".v3d-annotation { transition: border-radius 0.2s ease !important; }" +
      ".v3d-annotation.ann-hovered { border-radius: 5px !important; }" +
      ".ann-reply-img { cursor: pointer; transition: opacity 0.15s; }" +
      ".ann-reply-img:hover { opacity: 0.75; }" +
      ".ann-lightbox { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 100000; cursor: pointer; }" +
      ".ann-lightbox img { max-width: 90vw; max-height: 90vh; border-radius: 4px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }" +
      ".ann-replies-toggle { background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 11px; padding: 4px 0; width: 100%; text-align: left; transition: color 0.15s; }" +
      ".ann-replies-toggle:hover { color: #60a5fa; }";
    document.head.appendChild(css);
  })();

  window.setupAnnotationBridge = function (app) {
    if (!app) { console.error("[Annotation] setupAnnotationBridge: app is null"); return; }
    var css2dEls = [".v3d-css2d", ".v3d-annotation-container", ".annotation-container"];
    for (var ci = 0; ci < css2dEls.length; ci++) {
      var el = app.container.querySelector(css2dEls[ci]);
      if (el) { el.style.pointerEvents = "none"; var anns = el.querySelectorAll(".v3d-annotation, .annotation"); for (var aj = 0; aj < anns.length; aj++) anns[aj].style.pointerEvents = "auto"; break; }
    }
    window.addEventListener("message", function (event) {
      var msg = event.data;
      if (!msg || !msg.type) return;
      switch (msg.type) {
        case "create-annotation": handleCreateAnnotation(app, msg); break;
        case "move-annotation": handleMoveAnnotation(app, msg); break;
        case "update-annotation": handleUpdateAnnotation(app, msg); break;
        case "remove-annotation": handleRemoveAnnotation(app, msg); break;
        case "renumber-annotations": handleRenumberAnnotations(app, msg); break;
        case "start-pick-position": handleStartPickPosition(app, msg); break;
        case "cancel-pick-position": handleCancelPickPosition(app); break;
        case "get-marker-position": handleGetMarkerPosition(app, msg); break;
        case "ping-annotation": handlePingAnnotation(app, msg); break;
        case "annotation-update-counts": handleUpdateCounts(app, msg); break;
        case "annotation-add-reply": handleAddReply(app, msg); break;
        case "annotation-update-reply": handleUpdateReply(app, msg); break;
        case "show-annotations": case "hide-annotations": setAllAnnotationsVisible(app, msg.type === "show-annotations"); break;
        case "show-coordinates": case "hide-coordinates": setMarkerGroupVisible(app, msg.type === "show-coordinates"); break;
        case "set-active-axis": if(app.ExternalInterface&&app.ExternalInterface.setDragAxis){app.ExternalInterface.setDragAxis(msg.axis||null);} break;
        case "set-axis-edge-glow": console.log("[Annotation] set-axis-edge-glow received, axis:",msg.axis); if(!app.postprocessing||!app.postprocessing.outlinePass){console.log("[Annotation] outlinePass not available");break;} var oa=app.postprocessing.outlinePass.selectedObjects; var markers=["\\u6807\\u8BB0X","\\u6807\\u8BB0Y","\\u6807\\u8BB0Z"]; var glowAxis=msg.axis?"\\u6807\\u8BB0"+msg.axis.toUpperCase():null; for(var gmi=0;gmi<markers.length;gmi++){var obj=app.scene.getObjectByName(markers[gmi]);if(!obj)continue;var idx=oa.indexOf(obj);if(markers[gmi]===glowAxis){if(idx===-1)oa.push(obj);console.log("[Annotation] ENABLE outline for",markers[gmi]);}else{if(idx>-1)oa.splice(idx,1);console.log("[Annotation] DISABLE outline for",markers[gmi]);}} break;
      }
    });
    try { window.parent.postMessage({ type: "annotation-bridge-ready" }, "*"); } catch (e) {}
  };

  function handlePingAnnotation(app, msg) {
    var annotation = annotations[msg.commentId];
    if (!annotation) return;
    var el = annotation.annotation;
    if (!el) return;
    el.classList.remove("annotation-ping");
    void el.offsetWidth;
    el.classList.add("annotation-ping");
    setTimeout(function () { el.classList.remove("annotation-ping"); }, 700);
  }

  function getNextLabel() { return String(Object.keys(annotations).length + 1); }

  function buildDialogHtml(commentId, content, likes, dislikes, replyCount, replies, nickname, createdAt, images) {
    likes = typeof likes === "number" ? likes : 0;
    dislikes = typeof dislikes === "number" ? dislikes : 0;
    replyCount = typeof replyCount === "number" ? replyCount : 0;
    replies = replies || [];
    nickname = (nickname || "匿名用户");
    if (nickname.length > 8) nickname = nickname.substring(0, 8) + "...";
    images = images || [];
    var dateStr = "";
    if (createdAt) { var d = new Date(createdAt); var month = String(d.getMonth() + 1).padStart(2, "0"); var day = String(d.getDate()).padStart(2, "0"); var hour = String(d.getHours()).padStart(2, "0"); var min = String(d.getMinutes()).padStart(2, "0"); dateStr = month + "/" + day + " " + hour + ":" + min; }
    // 只显示最后一条回复，「共X条回复」按钮触发侧边栏展开
    var totalReplies = replies.length;
    function buildReplyItemHtml(r) { var likedAttr = r.likedBy && Array.isArray(r.likedBy) && r.likedBy.length > 0 ? "true" : "false"; var dislikedAttr = r.dislikedBy && Array.isArray(r.dislikedBy) && r.dislikedBy.length > 0 ? "true" : "false"; var rid = r._id || ""; var html = '<div class="ann-reply-item"' + (rid ? ' data-reply-id="' + rid + '"' : "") + '><div class="ann-reply-author">' + escapeHtml(r.nickname || "") + '</div><div class="ann-reply-text">' + escapeHtml(r.content || "") + "</div>"; if (r.images && r.images.length > 0) { html += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">'; for (var ri = 0; ri < r.images.length; ri++) html += '<img src="' + r.images[ri] + '" class="ann-reply-img" />'; html += "</div>"; } html += '<div class="ann-reply-actions"><button class="ann-btn ann-reply-like" data-comment-id="' + r._id + '" data-liked="' + likedAttr + '">' + SVG_HEART + ' ' + (r.likes || 0) + '</button><button class="ann-btn ann-reply-dislike" data-comment-id="' + r._id + '" data-disliked="' + dislikedAttr + '">' + SVG_DISLIKE + ' ' + (r.dislikes || 0) + '</button></div>'; html += "</div>"; return html; }
    var repliesHtml = "";
    if (totalReplies > 0) {
      var bestReply = (function () {
        var bestReplies = [];
        for (var br = 0; br < replies.length; br++) {
          if (replies[br].isBest) bestReplies.push(replies[br]);
        }
        if (bestReplies.length > 0) {
          bestReplies.sort(function (a, b) {
            if ((b.likes || 0) !== (a.likes || 0)) return (b.likes || 0) - (a.likes || 0);
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
          });
          return bestReplies[0];
        }
        var sorted = [].concat(replies);
        sorted.sort(function (a, b) {
          if ((b.likes || 0) !== (a.likes || 0)) return (b.likes || 0) - (a.likes || 0);
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
        return sorted[0];
      })();
      repliesHtml = buildReplyItemHtml(bestReply);
    }
    var toggleHtml = totalReplies > 1 ? '<button class="ann-replies-toggle">共 ' + totalReplies + ' 条回复</button>' : "";
    var imagesHtml = "";
    if (images.length > 0) { imagesHtml += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;margin-bottom:4px">'; for (var imgi = 0; imgi < images.length; imgi++) imagesHtml += '<img src="' + images[imgi] + '" class="ann-reply-img" />'; imagesHtml += "</div>"; }
    return '<div class="ann-hover-card" data-comment-id="' + commentId + '"><div class="ann-dialog-header"><div class="ann-dialog-header-top"><span class="ann-dialog-nickname">' + escapeHtml(nickname) + '</span><button class="ann-dialog-close" data-comment-id="' + commentId + '">x</button></div><span class="ann-dialog-date">' + dateStr + '</span></div><div class="ann-hover-content">' + escapeHtml(content || "") + "</div>" + imagesHtml + '<div class="ann-replies">' + repliesHtml + '</div>' + toggleHtml + '<div class="ann-hover-actions"><button class="ann-btn ann-like" data-comment-id="' + commentId + '" data-liked="false">' + SVG_HEART + " " + likes + '</button><button class="ann-btn ann-dislike" data-comment-id="' + commentId + '" data-disliked="false">' + SVG_DISLIKE + " " + dislikes + '</button><button class="ann-btn ann-reply" data-comment-id="' + commentId + '">' + SVG_REPLY + " " + replyCount + '</button><button class="ann-btn ann-dialog-focus" data-comment-id="' + commentId + '">···</button></div><div class="ann-hover-reply" style="display:none"><div class="ann-reply-preview" style="display:none"></div><div class="ann-reply-row"><input type="file" accept="image/*" class="ann-reply-file" style="display:none" /><input type="text" class="ann-reply-input" placeholder="写下回复..." /><button class="ann-reply-clip">' + SVG_PAPERCLIP + '</button><button class="ann-reply-send">发送</button></div></div></div>';
  }

  function addHoverHandlers(annotation, commentId) {
    var label = annotation.annotation;
    if (!label) return;
    var originalChar = annotation.character || "";
    var textEl = label.querySelector(".v3d-annotation-text");
    var domChar = textEl ? textEl.textContent : originalChar;
    label.dataset.originalChar = domChar;
    label.dataset.annOpen = "false";
    function setText(text) { var textEl = label.querySelector(".v3d-annotation-text"); if (textEl) { textEl.textContent = text; } else { for (var i = 0; i < label.childNodes.length; i++) { var node = label.childNodes[i]; if (node.nodeType === 3) { node.textContent = text; break; } } } }
    label.addEventListener("mouseenter", function () { if (label.dataset.annOpen === "true") return; label.classList.add("ann-hovered"); setText("+"); });
    label.addEventListener("mouseleave", function () { if (label.dataset.annOpen === "true") return; label.classList.remove("ann-hovered"); setText(originalChar); });
    label.addEventListener("click", function (e) {
      e.stopPropagation();
      var nowOpen = label.dataset.annOpen !== "true";
      if (nowOpen) { for (var id in annotations) { if (annotations.hasOwnProperty(id) && id !== commentId) { var other = annotations[id]; var otherLabel = other.annotation; if (otherLabel && otherLabel.dataset.annOpen === "true") { otherLabel.dataset.annOpen = "false"; var oTextEl = otherLabel.querySelector(".v3d-annotation-text"); if (oTextEl) { oTextEl.textContent = otherLabel.dataset.originalChar || ""; } else { for (var ni = 0; ni < otherLabel.childNodes.length; ni++) { var n = otherLabel.childNodes[ni]; if (n.nodeType === 3) { n.textContent = otherLabel.dataset.originalChar || ""; break; } } } otherLabel.classList.remove("ann-hovered"); } } } }
      label.dataset.annOpen = nowOpen ? "true" : "false";
      if (nowOpen) {
        setText("\\u2212"); label.classList.add("ann-hovered");
        var dlg=annotation.annotationDialog; if(dlg){dlg.style.visibility="visible";dlg.style.setProperty("display","block","important");} annotation.annotationDialogVisible=true;
      } else {
        var dlg=annotation.annotationDialog; if(dlg){dlg.style.visibility="hidden";dlg.style.display="";} annotation.annotationDialogVisible=false;
        setText(originalChar); label.classList.remove("ann-hovered");
      }
      window.parent.postMessage({ type: "ping-comment", commentId: commentId }, "*");
    });
  }

  function addDialogEventDelegation(annotation, commentId) {
    var dialog = annotation.annotationDialog;
    if (!dialog) return;
    annotation._dialogDelegation = function (event) {
      event.stopPropagation();
      var target = event.target;
      if (target.tagName === "path" || target.tagName === "svg") { var btn = target.closest("button"); if (btn) target = btn; }
      if (target.classList.contains("ann-like")) { event.stopPropagation(); var liked = target.getAttribute("data-liked") === "true"; var match = target.textContent.match(/\\d+/); var count = match ? parseInt(match[0], 10) : 0; if (liked) { target.setAttribute("data-liked", "false"); target.innerHTML = SVG_HEART + " " + Math.max(0, count - 1); } else { var dislikeBtn = dialog.querySelector(".ann-dislike"); if (dislikeBtn && dislikeBtn.getAttribute("data-disliked") === "true") { dislikeBtn.setAttribute("data-disliked", "false"); var dMatch = dislikeBtn.textContent.match(/\\d+/); var dCount = dMatch ? parseInt(dMatch[0], 10) : 0; dislikeBtn.innerHTML = SVG_DISLIKE + " " + Math.max(0, dCount - 1); } target.setAttribute("data-liked", "true"); target.innerHTML = SVG_HEART_FILLED + " " + (count + 1); } window.parent.postMessage({ type: "annotation-action", action: "like", commentId: commentId }, "*"); return; }
      if (target.classList.contains("ann-dislike")) { event.stopPropagation(); var disliked = target.getAttribute("data-disliked") === "true"; var match = target.textContent.match(/\\d+/); var count = match ? parseInt(match[0], 10) : 0; if (disliked) { target.setAttribute("data-disliked", "false"); target.innerHTML = SVG_DISLIKE + " " + Math.max(0, count - 1); } else { var likeBtn = dialog.querySelector(".ann-like"); if (likeBtn && likeBtn.getAttribute("data-liked") === "true") { likeBtn.setAttribute("data-liked", "false"); var lMatch = likeBtn.textContent.match(/\\d+/); var lCount = lMatch ? parseInt(lMatch[0], 10) : 0; likeBtn.innerHTML = SVG_HEART + " " + Math.max(0, lCount - 1); } target.setAttribute("data-disliked", "true"); target.innerHTML = SVG_DISLIKE + " " + (count + 1); } window.parent.postMessage({ type: "annotation-action", action: "dislike", commentId: commentId }, "*"); return; }
      if (target.classList.contains("ann-reply")) { event.stopPropagation(); var replySection = dialog.querySelector(".ann-hover-reply"); if (!replySection) return; if (replySection.style.display === "flex") { replySection.style.display = "none"; } else { replySection.style.display = "flex"; var input = replySection.querySelector(".ann-reply-input"); if (input) input.focus(); } return; }
      function sendReply() { var replySection = dialog.querySelector(".ann-hover-reply"); if (!replySection) return; var input = replySection.querySelector(".ann-reply-input"); var preview = replySection.querySelector(".ann-reply-preview"); var images = []; try { images = JSON.parse(preview.getAttribute("data-images") || "[]"); } catch (e) {} var text = (input && input.value.trim()) || ""; if (text || images.length > 0) { window.parent.postMessage({ type: "annotation-action", action: "reply", commentId: commentId, text: text, images: images.length > 0 ? images : undefined }, "*"); if (input) input.value = ""; if (preview) { preview.removeAttribute("data-images"); preview.innerHTML = ""; preview.style.display = "none"; } replySection.style.display = "none"; } }
      function updatePreview(images) { var preview = dialog.querySelector(".ann-reply-preview"); if (!preview) return; preview.setAttribute("data-images", JSON.stringify(images)); if (images.length > 0) { preview.innerHTML = images.map(function (url, i) { return '<div class="ann-reply-preview-item"><img src="' + url + '" /><button class="ann-reply-img-remove" data-index="' + i + '">\\u00d7</button></div>'; }).join(""); preview.style.display = "flex"; } else { preview.innerHTML = ""; preview.style.display = "none"; } }
      if (target.classList.contains("ann-reply-clip")) { event.stopPropagation(); var fileInput = dialog.querySelector(".ann-reply-file"); if (fileInput) fileInput.click(); return; }
      if (target.classList.contains("ann-reply-img-remove")) { event.stopPropagation(); var preview = dialog.querySelector(".ann-reply-preview"); if (!preview) return; var images = []; try { images = JSON.parse(preview.getAttribute("data-images") || "[]"); } catch (e) {} var idx = parseInt(target.getAttribute("data-index"), 10); if (!isNaN(idx) && idx >= 0 && idx < images.length) { images.splice(idx, 1); updatePreview(images); } return; }
      if (target.classList.contains("ann-reply-send")) { event.stopPropagation(); sendReply(); return; }
      if (target.classList.contains("ann-replies-toggle")) { event.stopPropagation(); window.parent.postMessage({ type: "annotation-action", action: "focus-comment-and-expand", commentId: commentId }, "*"); return; }
      if (target.classList.contains("ann-reply-img")) { event.stopPropagation(); var src = target.getAttribute("src"); if (src) { var overlay = document.createElement("div"); overlay.className = "ann-lightbox"; var img = document.createElement("img"); img.src = src; overlay.appendChild(img); overlay.addEventListener("click", function () { document.body.removeChild(overlay); }); document.body.appendChild(overlay); } return; }
      // 回复：❤ 赞
      if (target.classList.contains("ann-reply-like")) { event.stopPropagation(); var rLiked = target.getAttribute("data-liked") === "true"; var rMatch = target.textContent.match(/\d+/); var rCount = rMatch ? parseInt(rMatch[0], 10) : 0; if (rLiked) { target.setAttribute("data-liked", "false"); target.innerHTML = SVG_HEART + " " + Math.max(0, rCount - 1); } else { var parentItem = target.closest(".ann-reply-item"); if (parentItem) { var rDislike = parentItem.querySelector(".ann-reply-dislike"); if (rDislike && rDislike.getAttribute("data-disliked") === "true") { rDislike.setAttribute("data-disliked", "false"); var rdMatch = rDislike.textContent.match(/\d+/); var rdCount = rdMatch ? parseInt(rdMatch[0], 10) : 0; rDislike.innerHTML = SVG_DISLIKE + " " + Math.max(0, rdCount - 1); } } target.setAttribute("data-liked", "true"); target.innerHTML = SVG_HEART_FILLED + " " + (rCount + 1); } window.parent.postMessage({ type: "annotation-action", action: "like-reply", commentId: target.getAttribute("data-comment-id") }, "*"); return; }
      // 回复：👍 踩
      if (target.classList.contains("ann-reply-dislike")) { event.stopPropagation(); var rDisliked = target.getAttribute("data-disliked") === "true"; var rdMatch = target.textContent.match(/\d+/); var rdCount = rdMatch ? parseInt(rdMatch[0], 10) : 0; if (rDisliked) { target.setAttribute("data-disliked", "false"); target.innerHTML = SVG_DISLIKE + " " + Math.max(0, rdCount - 1); } else { var parentItem = target.closest(".ann-reply-item"); if (parentItem) { var rLike = parentItem.querySelector(".ann-reply-like"); if (rLike && rLike.getAttribute("data-liked") === "true") { rLike.setAttribute("data-liked", "false"); var rlMatch = rLike.textContent.match(/\d+/); var rlCount = rlMatch ? parseInt(rlMatch[0], 10) : 0; rLike.innerHTML = SVG_HEART + " " + Math.max(0, rlCount - 1); } } target.setAttribute("data-disliked", "true"); target.innerHTML = SVG_DISLIKE + " " + (rdCount + 1); } window.parent.postMessage({ type: "annotation-action", action: "dislike-reply", commentId: target.getAttribute("data-comment-id") }, "*"); return; }
      // 回复：× 删除
      if (target.classList.contains("ann-reply-delete")) { event.stopPropagation(); if (!confirm("确定删除此回复？")) return; window.parent.postMessage({ type: "annotation-action", action: "delete-reply", commentId: target.getAttribute("data-comment-id") }, "*"); return; }
      // 回复：··· 聚焦侧边栏
      if (target.classList.contains("ann-reply-focus")) { event.stopPropagation(); window.parent.postMessage({ type: "annotation-action", action: "focus-comment", commentId: target.getAttribute("data-comment-id") }, "*"); return; }
      if (target.classList.contains("ann-dialog-close")) { event.stopPropagation(); dialog.style.setProperty("display","block","important"); dialog.style.transition="opacity 0.2s ease, transform 0.2s ease"; dialog.style.opacity="0"; dialog.style.transform="translateX(-12px)"; setTimeout(function() { dialog.style.transition=""; dialog.style.transform=""; dialog.style.opacity=""; dialog.style.display=""; var cl = annotation.annotation; if (cl) { cl.dataset.annOpen = "false"; var cte = cl.querySelector(".v3d-annotation-text"); if (cte) { cte.textContent = cl.dataset.originalChar || ""; } else { for (var cni = 0; cni < cl.childNodes.length; cni++) { var cn = cl.childNodes[cni]; if (cn.nodeType === 3) { cn.textContent = cl.dataset.originalChar || ""; break; } } } cl.classList.remove("ann-hovered"); } annotation.annotationDialogVisible = false; dialog.style.visibility = "hidden"; }, 200); return; }
      if (target.classList.contains("ann-dialog-focus")) { event.stopPropagation(); window.parent.postMessage({ type: "annotation-action", action: "focus-comment", commentId: commentId }, "*"); return; }
    };
    dialog.addEventListener("click", annotation._dialogDelegation);
    annotation._replyKeyHandler = function (event) { if (event.key === "Enter") { var replySection = dialog.querySelector(".ann-hover-reply"); if (!replySection) return; var input = replySection.querySelector(".ann-reply-input"); var preview = replySection.querySelector(".ann-reply-preview"); var images = []; try { images = JSON.parse(preview.getAttribute("data-images") || "[]"); } catch (e) {} if ((input && input.value.trim()) || images.length > 0) sendReply(); } };
    annotation._replyPasteHandler = function (event) { var items = event.clipboardData && event.clipboardData.items; if (!items) return; for (var i = 0; i < items.length; i++) { if (items[i].type.indexOf("image") === 0) { event.preventDefault(); var file = items[i].getAsFile(); if (!file) return; var preview = dialog.querySelector(".ann-reply-preview"); if (!preview) return; var images = []; try { images = JSON.parse(preview.getAttribute("data-images") || "[]"); } catch (e) {} if (images.length >= 2) return; compressImage(file, null, function (dataUrl) { if (dataUrl) { images.push(dataUrl); updatePreview(images); } }); return; } } };
    var replyInput = dialog.querySelector(".ann-reply-input"); if (replyInput) { replyInput.addEventListener("keydown", annotation._replyKeyHandler); replyInput.addEventListener("paste", annotation._replyPasteHandler); }
    var fileInput = dialog.querySelector(".ann-reply-file"); if (fileInput) { annotation._fileChangeHandler = function (e) { var files = e.target.files; if (!files || files.length === 0) return; var preview = dialog.querySelector(".ann-reply-preview"); if (!preview) return; var images = []; try { images = JSON.parse(preview.getAttribute("data-images") || "[]"); } catch (e) {} for (var fi = 0; fi < files.length && images.length < 2; fi++) { (function (file) { if (!file) return; compressImage(file, null, function (dataUrl) { if (dataUrl && images.length < 2) { images.push(dataUrl); updatePreview(images); } }); })(files[fi]); } e.target.value = ""; }; fileInput.addEventListener("change", annotation._fileChangeHandler); }
  }

  function removeAnnotationListeners(annotation) { if (annotation._hideTimer) { clearTimeout(annotation._hideTimer); annotation._hideTimer = null; } var dialog = annotation.annotationDialog; if (dialog) { if (annotation._dialogDelegation) { dialog.removeEventListener("click", annotation._dialogDelegation); annotation._dialogDelegation = null; } var replyInput = dialog.querySelector(".ann-reply-input"); if (replyInput && annotation._replyKeyHandler) { replyInput.removeEventListener("keydown", annotation._replyKeyHandler); annotation._replyKeyHandler = null; } if (replyInput && annotation._replyPasteHandler) { replyInput.removeEventListener("paste", annotation._replyPasteHandler); annotation._replyPasteHandler = null; } var fileInput = dialog.querySelector(".ann-reply-file"); if (fileInput && annotation._fileChangeHandler) { fileInput.removeEventListener("change", annotation._fileChangeHandler); annotation._fileChangeHandler = null; } } }

  function handleCreateAnnotation(app, msg) {
    if (!msg.commentId || !msg.position) return;
    if (annotations[msg.commentId]) { annotations[msg.commentId].position.set(msg.position.x, msg.position.y, msg.position.z); return; }
    try {
      var label = getNextLabel();
      var dialog = buildDialogHtml(msg.commentId, msg.content, msg.likes, msg.dislikes, msg.replyCount, msg.replies, msg.nickname, msg.createdAt, msg.images);
      var annotation = new v3d.Annotation(app.container, label, dialog);
      annotation.fadeObscured = false;
      if (annotation.annotation) { annotation.annotation.style.setProperty("pointer-events", "auto", "important"); annotation.annotation.style.setProperty("z-index", "9999", "important"); }
      annotation.position.set(msg.position.x, msg.position.y, msg.position.z);
      app.scene.add(annotation);
      annotations[msg.commentId] = annotation;
      annotation._replies = msg.replies || [];
      addHoverHandlers(annotation, msg.commentId);
      addDialogEventDelegation(annotation, msg.commentId);
    } catch (e) { console.error("[Annotation] Create failed:", e); }
  }

  function handleMoveAnnotation(app, msg) { var annotation = annotations[msg.commentId]; if (!annotation) return; annotation.position.set(msg.position.x, msg.position.y, msg.position.z); }

  function handleUpdateAnnotation(app, msg) {
    var annotation = annotations[msg.commentId]; if (!annotation) return;
    try {
      if (annotation.annotationDialog) {
        var contentEl = annotation.annotationDialog.querySelector(".ann-hover-content");
        if (contentEl) { contentEl.innerHTML = escapeHtml(msg.content || ""); } else { annotation.annotationDialog.innerHTML = escapeHtml(msg.content || ""); }
        annotation.dialogContents = msg.content || "";
        if (typeof msg.likes === "number") { var likeBtn = annotation.annotationDialog.querySelector(".ann-like"); if (likeBtn) { var liked = likeBtn.getAttribute("data-liked") === "true"; likeBtn.innerHTML = (liked ? SVG_HEART_FILLED : SVG_HEART) + " " + msg.likes; } }
        if (typeof msg.dislikes === "number") { var dislikeBtn = annotation.annotationDialog.querySelector(".ann-dislike"); if (dislikeBtn) dislikeBtn.innerHTML = SVG_DISLIKE + " " + msg.dislikes; }
        if (typeof msg.replyCount === "number") { var replyBtn = annotation.annotationDialog.querySelector(".ann-reply"); if (replyBtn) replyBtn.innerHTML = SVG_REPLY + " " + msg.replyCount; }
      } else {
        var pos = annotation.position.clone(); var label = annotation.character || getNextLabel(); removeAnnotationListeners(annotation); app.scene.remove(annotation); delete annotations[msg.commentId];
        var dialog = buildDialogHtml(msg.commentId, msg.content, msg.likes, msg.dislikes, msg.replyCount, msg.replies, msg.nickname, msg.createdAt, msg.images);
        var newAnn = new v3d.Annotation(app.container, label, dialog); newAnn.fadeObscured = false; newAnn.position.copy(pos); app.scene.add(newAnn); annotations[msg.commentId] = newAnn; addHoverHandlers(newAnn, msg.commentId); addDialogEventDelegation(newAnn, msg.commentId);
      }
    } catch (e) { console.error("[Annotation] Update failed:", e); }
  }

  function handleUpdateCounts(app, msg) { var annotation = annotations[msg.commentId]; if (!annotation || !annotation.annotationDialog) return; if (typeof msg.likes === "number") { var likeBtn = annotation.annotationDialog.querySelector(".ann-like"); if (likeBtn) { var liked = msg.userLiked === true || likeBtn.getAttribute("data-liked") === "true"; likeBtn.innerHTML = (liked ? SVG_HEART_FILLED : SVG_HEART) + " " + msg.likes; if (typeof msg.userLiked === "boolean") likeBtn.setAttribute("data-liked", String(msg.userLiked)); } } if (typeof msg.dislikes === "number") { var dislikeBtn = annotation.annotationDialog.querySelector(".ann-dislike"); if (dislikeBtn) { dislikeBtn.innerHTML = SVG_DISLIKE + " " + msg.dislikes; if (typeof msg.userDisliked === "boolean") dislikeBtn.setAttribute("data-disliked", String(msg.userDisliked)); } } if (typeof msg.replyCount === "number") { var replyBtn = annotation.annotationDialog.querySelector(".ann-reply"); if (replyBtn) replyBtn.innerHTML = SVG_REPLY + " " + msg.replyCount; } }

  function handleAddReply(app, msg) { var annotation = annotations[msg.commentId]; if (!annotation) return; if (!annotation.annotationDialog) return; var repliesContainer = annotation.annotationDialog.querySelector(".ann-replies"); if (!repliesContainer) return; var replyItem = document.createElement("div"); replyItem.className = "ann-reply-item"; var innerHtml = '<div class="ann-reply-author">' + escapeHtml(msg.nickname || "") + '</div><div class="ann-reply-text">' + escapeHtml(msg.content || "") + "</div>"; if (msg.images && msg.images.length > 0) { innerHtml += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">'; for (var ii = 0; ii < msg.images.length; ii++) innerHtml += '<img src="' + msg.images[ii] + '" class="ann-reply-img" />'; innerHtml += "</div>"; } innerHtml += '<div class="ann-reply-actions"><button class="ann-btn ann-reply-like" data-comment-id="' + msg._id + '" data-liked="false">' + SVG_HEART + ' 0</button><button class="ann-btn ann-reply-dislike" data-comment-id="' + msg._id + '" data-disliked="false">' + SVG_DISLIKE + ' 0</button></div>'; replyItem.innerHTML = innerHtml; repliesContainer.appendChild(replyItem); if (annotation._replies) { annotation._replies.push({ _id: msg._id || "", nickname: msg.nickname || "", content: msg.content || "", likes: 0, dislikes: 0, createdAt: new Date().toISOString(), isBest: false, images: msg.images || [] }); } var allItems = repliesContainer.querySelectorAll(".ann-reply-item"); var toggle = repliesContainer.querySelector(".ann-replies-toggle"); if (allItems.length >= 2 && !toggle) { toggle = document.createElement("button"); toggle.className = "ann-replies-toggle"; toggle.textContent = "共 " + allItems.length + " 条回复"; repliesContainer.parentNode.appendChild(toggle); } else if (toggle) { toggle.textContent = "共 " + allItems.length + " 条回复"; } if (typeof msg.replyCount === "number") { var replyBtn = annotation.annotationDialog.querySelector(".ann-reply"); if (replyBtn) replyBtn.innerHTML = SVG_REPLY + " " + msg.replyCount; } }

  function rebuildAnnotationReplies(annotation) { if (!annotation || !annotation.annotationDialog || !annotation._replies) return; var replies = annotation._replies; var totalReplies = replies.length; var container = annotation.annotationDialog.querySelector(".ann-replies"); if (!container) return; var html = ""; if (totalReplies > 0) { var bestReply = (function () { var bestReplies = []; for (var br = 0; br < replies.length; br++) { if (replies[br].isBest) bestReplies.push(replies[br]); } if (bestReplies.length > 0) { bestReplies.sort(function (a, b) { if ((b.likes || 0) !== (a.likes || 0)) return (b.likes || 0) - (a.likes || 0); return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(); }); return bestReplies[0]; } var sorted = [].concat(replies); sorted.sort(function (a, b) { if ((b.likes || 0) !== (a.likes || 0)) return (b.likes || 0) - (a.likes || 0); return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(); }); return sorted[0]; })(); var r = bestReply; var rid = r._id || ""; html = '<div class="ann-reply-item"' + (rid ? ' data-reply-id="' + rid + '"' : "") + '><div class="ann-reply-author">' + escapeHtml(r.nickname || "") + '</div><div class="ann-reply-text">' + escapeHtml(r.content || "") + "</div>"; if (r.images && r.images.length > 0) { html += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">'; for (var ri = 0; ri < r.images.length; ri++) { html += '<img src="' + r.images[ri] + '" class="ann-reply-img" />'; } html += "</div>"; } html += "</div>"; } container.innerHTML = html; }

  function handleUpdateReply(app, msg) { var annotation = annotations[msg.commentId]; if (!annotation || !annotation.annotationDialog) return; if (!annotation._replies) return; var found = false; for (var ri = 0; ri < annotation._replies.length; ri++) { if (annotation._replies[ri]._id === msg.replyId) { if (typeof msg.isBest === "boolean") annotation._replies[ri].isBest = msg.isBest; if (typeof msg.likes === "number") annotation._replies[ri].likes = msg.likes; if (typeof msg.dislikes === "number") annotation._replies[ri].dislikes = msg.dislikes; if (typeof msg.content === "string") annotation._replies[ri].content = msg.content; found = true; break; } } if (found) { rebuildAnnotationReplies(annotation); var toggle = annotation.annotationDialog.querySelector(".ann-replies-toggle"); if (toggle && annotation._replies.length > 1) { toggle.textContent = "共 " + annotation._replies.length + " 条回复"; } } }

  function handleRemoveAnnotation(app, msg) { var annotation = annotations[msg.commentId]; if (!annotation) return; removeAnnotationListeners(annotation); removeAnnotationDOM(annotation); app.scene.remove(annotation); delete annotations[msg.commentId]; try { window.parent.postMessage({ type: "annotation-removed", commentId: msg.commentId }, "*"); } catch (e) {} }

  function handleRenumberAnnotations(app, msg) { var list = msg.annotations; if (!list || !list.length) { clearAllAnnotations(app); return; } clearAllAnnotations(app); for (var i = 0; i < list.length; i++) { var item = list[i]; if (!item.commentId || !item.position) continue; try { var label = String(i + 1); var dialog = buildDialogHtml(item.commentId, item.content, item.likes, item.dislikes, item.replyCount, item.replies, item.nickname, item.createdAt, item.images); var annotation = new v3d.Annotation(app.container, label, dialog); annotation.fadeObscured = false; if (annotation.annotation) annotation.annotation.style.setProperty("pointer-events", "auto", "important"); annotation.position.set(item.position.x, item.position.y, item.position.z); app.scene.add(annotation); annotations[item.commentId] = annotation; annotation._replies = item.replies || []; addHoverHandlers(annotation, item.commentId); addDialogEventDelegation(annotation, item.commentId); } catch (e) { console.error("[Annotation] Rebuild failed for", item.commentId, e); } } }

  function clearAllAnnotations(app) { for (var key in annotations) { if (annotations.hasOwnProperty(key)) { removeAnnotationListeners(annotations[key]); removeAnnotationDOM(annotations[key]); app.scene.remove(annotations[key]); } } for (var k in annotations) { if (annotations.hasOwnProperty(k)) delete annotations[k]; } }

  function setAllAnnotationsVisible(app,visible){var anns=app.container.querySelectorAll(".v3d-annotation");for(var i=0;i<anns.length;i++){anns[i].style.display=visible?"":"none";}}

  var _markerGroupVisible = true;
  function setMarkerGroupVisible(app, visible) { _markerGroupVisible = visible; var group = app.scene.getObjectByName("标记"); if (group) { group.visible = visible; return; } var markerNames = ["标记X", "标记Y", "标记Z"]; for (var i = 0; i < markerNames.length; i++) { var obj = app.scene.getObjectByName(markerNames[i]); if (obj) obj.visible = visible; } }

  function removeAnnotationDOM(annotation) { try { if (annotation.annotation && annotation.annotation.parentNode) annotation.annotation.parentNode.removeChild(annotation.annotation); } catch (e) {} }

  function handleStartPickPosition(app, msg) { handleCancelPickPosition(app); pickState = { commentId: msg.commentId }; var canvas = app.renderer && app.renderer.domElement; if (!canvas) { console.error("[Annotation] No canvas found"); pickState = null; return; } canvas.style.cursor = "crosshair"; pickState.onClick = function (event) { if (!pickState) return; var rect = canvas.getBoundingClientRect(); var mouse = new v3d.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); var raycaster = new v3d.Raycaster(); raycaster.setFromCamera(mouse, app.camera); var intersects = raycaster.intersectObjects(app.scene.children, true); if (intersects.length > 0) { var hit = intersects[0]; var point = hit.point; try { window.parent.postMessage({ type: "position-picked", commentId: pickState.commentId, position: { x: point.x, y: point.y, z: point.z } }, "*"); } catch (e) {} handleCancelPickPosition(app); } }; canvas.addEventListener("click", pickState.onClick); }

  function handleCancelPickPosition(app) { if (!pickState) return; var canvas = app.renderer && app.renderer.domElement; if (canvas) { canvas.style.cursor = "default"; if (pickState.onClick) canvas.removeEventListener("click", pickState.onClick); } pickState = null; }

  function handleGetMarkerPosition(app, msg) { var pos = null; try { if (app.ExternalInterface && typeof app.ExternalInterface.getMarkerPosition === "function") pos = app.ExternalInterface.getMarkerPosition(); } catch (e) {} if (pos && typeof pos.x === "number") { window.parent.postMessage({ type: "marker-position", commentId: msg.commentId, position: { x: pos.x, y: pos.y, z: pos.z } }, "*"); } else { handleStartPickPosition(app, msg); } }

  window.restoreAnnotations = function (app, comments) { if (!comments || !comments.length) return; comments.forEach(function (c) { handleCreateAnnotation(app, { commentId: c.commentId, position: c.position, content: c.content, likes: c.likes, dislikes: c.dislikes, replyCount: c.replyCount, replies: c.replies, nickname: c.nickname, createdAt: c.createdAt }); }); };

  var SVG_HEART = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  var SVG_HEART_FILLED = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  var SVG_DISLIKE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>';
  var SVG_REPLY = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var SVG_PAPERCLIP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';

  function escapeHtml(str) { var d = document.createElement("div"); d.appendChild(document.createTextNode(str)); return d.innerHTML; }

  function compressImage(file, maxBytes, callback) { maxBytes = maxBytes || 20 * 1024; var reader = new FileReader(); reader.onload = function () { var img = new Image(); img.onload = function () { var w = img.width, h = img.height; var MAX_W = 240; if (w > MAX_W) { h = Math.round(h * (MAX_W / w)); w = MAX_W; } var canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h; var ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0, w, h); var quality = 0.7; var result = canvas.toDataURL("image/jpeg", quality); if (result.length > maxBytes) { var lo = 0.1, hi = 0.7; for (var i = 0; i < 8; i++) { quality = (lo + hi) / 2; result = canvas.toDataURL("image/jpeg", quality); if (result.length > maxBytes) hi = quality; else lo = quality; } } callback(result); }; img.onerror = function () { callback(null); }; img.src = reader.result; }; reader.onerror = function () { callback(null); }; reader.readAsDataURL(file); }
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
  r = r.replace(
    /<title>.*?<\/title>/,
    `<title>3D 展示 - ${projectName}</title>`,
  );
  r = r.replace(/<!-- Search Engines -->[\s\S]*?(?=<script)/, "");
  r = r.replace(/<!-- (Twitter|Open Graph) -->[\s\S]*?(?=<script)/g, "");
  r = r.replace(/<!-- favicons -->[\s\S]*?(?=<script)/, "");
  r = r.replace(/<meta[^>]*soft8soft[^>]*>/gi, "");
  r = r.replace(
    /<div id="v3d-container">[\s\S]*?<\/div>\s*<\/div>/,
    '<div id="v3d-container"></div>',
  );
  r = r.replace(
    '<script src="v3d.js"></script>',
    '<script src="v3d.js"></script>\n  <script src="marker-drag.js"></script>\n  <script src="annotation.js"></script>',
  );
  r = r.replace(
    /(<script\s+src=")(?!v3d\.js|marker-drag\.js|annotation\.js)([^"]*\.js)(">)/,
    `$1$2?v=${Date.now()}$3`,
  );
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
  r = r.replace(
    /function prepareFullscreen[\s\S]*?function prepareExternalInterface/,
    "function prepareExternalInterface",
  );
  r = r.replace(
    /const disposeFullscreen\s*=\s*prepareFullscreen[\s\S]*?\)\s*;/m,
    "",
  );
  r = r.replace(
    /^\s*app\.addEventListener\([\s\S]*?dispose[\s\S]*?\)\s*;/m,
    "",
  );
  r = r.replace(
    /new v3d\.SimplePreloader\(\{ container: containerId \}\)/,
    "createRingPreloader()",
  );
  r = r.replace(
    /const preloader = initOptions\.useCustomPreloader\s*\?[\s\S]*?\: createRingPreloader\(\)/g,
    "const preloader = createRingPreloader()",
  );

  if (!r.includes("function createRingPreloader")) {
    r = r.replace(
      /function createAppInstance/,
      `${RING_PRELOADER_JS}\n\nfunction createAppInstance`,
    );
  }
  if (!r.includes("setupDraggableMarker")) {
    const DRAG_INIT = `\n        const drag = setupDraggableMarker(app);\n        app.ExternalInterface.resetMarkerPosition = function() { drag.resetPosition(); };\n        app.ExternalInterface.getMarkerPosition = function() { var m = drag.getMarker(); return m ? { x: m.x, y: m.y, z: m.z } : null; };\n        app.ExternalInterface.setDragAxis = function(axis) { drag.setAxis(axis); };`;
    r = r.replace(
      /runCode\(app, PL\);/g,
      `${DRAG_INIT}\n        runCode(app, PL);`,
    );
  }
  if (!r.includes("setupAnnotationBridge")) {
    const ANN_INIT = `\n        (function() {\n            function init() {\n                if (!app || !app.scene || !app.scene.children.length) { setTimeout(init, 500); return; }\n                if (typeof setupAnnotationBridge === 'function') setupAnnotationBridge(app);\n            }\n            init();\n        })();`;
    r = r.replace(
      /runCode\(app, PL\);/g,
      `${ANN_INIT}\n        runCode(app, PL);`,
    );
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
export function categorizeFile(
  name: string,
  excludeImages = true,
): FileCategory {
  if (shouldSkip(name, excludeImages)) return "skip";
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "css") return "css";
  if (ext === "js" && name !== "v3d.js") return "js";
  return "other";
}
