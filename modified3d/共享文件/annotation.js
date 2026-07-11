/**
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
      /* 确保 annotation dot 在顶层且可点击 */
      ".v3d-annotation, .v3d-annotation * {" +
      "  pointer-events: auto !important;" +
      "  z-index: 1000 !important;" +
      "}" +
      /* dialog 容器 — 让 Verge3D 原生 toggle 控制显隐 */
      ".v3d-annotation-dialog, .annotation-dialog {" +
      "  pointer-events: auto !important;" +
      "  z-index: 1001 !important;" +
      "}" +
      /* 闪烁动画 */
      "@keyframes annotationPing {" +
      "  0% { outline: 2px solid transparent; outline-offset: 2px; }" +
      "  50% { outline: 2px solid #3b82f6; outline-offset: 4px; }" +
      "  100% { outline: 2px solid transparent; outline-offset: 2px; }" +
      "}" +
      ".annotation-ping {" +
      "  animation: annotationPing 0.6s ease-in-out !important;" +
      "}" +
      /* 悬停弹窗卡片 */
      ".ann-hover-card {" +
      "  padding: 3px;" +
      "  min-width: 200px;" +
      "  max-width: 260px;" +
      "}" +
      /* dialog 头部行：用户名 日期 X */
      ".ann-dialog-header {" +
      "  display: flex;" +
      "  flex-direction: column;" +
      "  gap: 1px;" +
      "  padding: 0;" +
      "  border-bottom: 1px solid rgba(255,255,255,0.15);" +
      "  margin-bottom: 4px;" +
      "  text-align: left;" +
      "}" +
      ".ann-dialog-header-top {" +
      "  display: flex;" +
      "  align-items: center;" +
      "  justify-content: space-between;" +
      "}" +
      ".ann-dialog-nickname {" +
      "  font-size: 12px;" +
      "  font-weight: 500;" +
      "  color: #e5e7eb;" +
      "  white-space: nowrap;" +
      "}" +
      ".ann-dialog-date-row {" +
      "  display: flex;" +
      "  align-items: center;" +
      "  justify-content: space-between;" +
      "}" +
      ".ann-dialog-date {" +
      "  font-size: 10px;" +
      "  color: #9ca3af;" +
      "  white-space: nowrap;" +
      "  text-align: left;" +
      "}" +
      ".ann-dialog-date-more {" +
      "  background: none;" +
      "  border: none;" +
      "  color: #9ca3af;" +
      "  font-size: 14px;" +
      "  line-height: 1;" +
      "  cursor: pointer;" +
      "  padding: 0 2px;" +
      "}" +
      ".ann-dialog-date-more:hover {" +
      "  color: #e5e7eb;" +
      "}" +
      ".ann-dialog-close {" +
      "  margin-left: auto;" +
      "  background: none;" +
      "  border: none;" +
      "  color: #9ca3af;" +
      "  cursor: pointer;" +
      "  font-size: 12px;" +
      "  line-height: 1;" +
      "  padding: 0 2px;" +
      "  transition: color 0.15s;" +
      "}" +
      ".ann-dialog-close:hover {" +
      "  color: #ef4444;" +
      "}" +
      ".ann-hover-content {" +
      "  font-size: 13px;" +
      "  color: #fff;" +
      "  text-align: left;" +
      "  line-height: 1.4;" +
      "  margin-bottom: 4px;" +
      "}" +
      ".ann-hover-actions {" +
      "  display: flex;" +
      "  gap: 12px;" +
      "  align-items: center;" +
      "}" +
      ".ann-btn {" +
      "  background: none;" +
      "  border: none;" +
      "  cursor: pointer;" +
      "  font-size: 13px;" +
      "  padding: 2px 4px;" +
      "  display: flex;" +
      "  align-items: center;" +
      "  gap: 3px;" +
      "  color: #666;" +
      "  transition: color 0.15s;" +
      "}" +
      ".ann-btn:hover {" +
      "  color: #333;" +
      "}" +
      ".ann-like:hover { color: #e74c3c; }" +
      ".ann-dislike:hover { color: #e67e22; }" +
      ".ann-reply:hover { color: #3498db; }" +
      ".ann-dialog-focus {" +
      "  margin-left: auto;" +
      "  color: #9ca3af;" +
      "  font-size: 16px;" +
      "  line-height: 1;" +
      "}" +
      ".ann-dialog-focus:hover { color: #e5e7eb; }" +
      ".ann-hover-reply {" +
      "  margin-top: 6px;" +
      "}" +
      ".ann-reply-row {" +
      "  display: flex;" +
      "  gap: 4px;" +
      "}" +
      ".ann-reply-preview {" +
      "  display: flex;" +
      "  gap: 6px;" +
      "  flex-wrap: wrap;" +
      "  margin-bottom: 4px;" +
      "}" +
      ".ann-reply-preview-item {" +
      "  position: relative;" +
      "  display: inline-block;" +
      "}" +
      ".ann-reply-preview-item img {" +
      "  height: 48px;" +
      "  width: 48px;" +
      "  object-fit: cover;" +
      "  border-radius: 4px;" +
      "  border: 1px solid rgba(255,255,255,0.2);" +
      "}" +
      ".ann-reply-preview-item .ann-reply-img-remove {" +
      "  position: absolute;" +
      "  top: -6px;" +
      "  right: -6px;" +
      "  width: 16px;" +
      "  height: 16px;" +
      "  border-radius: 50%;" +
      "  background: #6b7280;" +
      "  color: #fff;" +
      "  border: none;" +
      "  font-size: 11px;" +
      "  line-height: 1;" +
      "  cursor: pointer;" +
      "  display: flex;" +
      "  align-items: center;" +
      "  justify-content: center;" +
      "  padding: 0;" +
      "}" +
      ".ann-reply-preview-item .ann-reply-img-remove:hover {" +
      "  background: #ef4444;" +
      "}" +
      ".ann-reply-clip {" +
      "  background: none;" +
      "  border: none;" +
      "  cursor: pointer;" +
      "  font-size: 14px;" +
      "  line-height: 1;" +
      "  padding: 2px 4px;" +
      "  color: #9ca3af;" +
      "  transition: color 0.15s;" +
      "}" +
      ".ann-reply-clip:hover {" +
      "  color: #e5e7eb;" +
      "}" +
      ".ann-reply-input {" +
      "  flex: 1;" +
      "  border: 1px solid #ddd;" +
      "  border-radius: 4px;" +
      "  padding: 4px 8px;" +
      "  font-size: 12px;" +
      "  outline: none;" +
      "}" +
      ".ann-reply-img {" +
      "  max-height: 64px;" +
      "  max-width: 100%;" +
      "  border-radius: 4px;" +
      "  border: 1px solid rgba(255,255,255,0.15);" +
      "  margin-top: 2px;" +
      "  object-fit: contain;" +
      "}" +
      ".ann-reply-send {" +
      "  background: #3b82f6;" +
      "  color: white;" +
      "  border: none;" +
      "  border-radius: 4px;" +
      "  padding: 4px 10px;" +
      "  font-size: 12px;" +
      "  cursor: pointer;" +
      "}" +
      /* 回复列表 */
      ".ann-replies {" +
      "  margin: 4px 0;" +
      "  max-height: 120px;" +
      "  overflow-y: auto;" +
      "  padding-left: 1em;" +
      "}" +
      ".ann-reply-item {" +
      "  display: flex;" +
      "  flex-direction: column;" +
      "  gap: 2px;" +
      "  padding: 3px 0;" +
      "  border-bottom: 1px solid rgba(255,255,255,0.08);" +
      "  font-size: 12px;" +
      "}" +
      ".ann-reply-author {" +
      "  color: #93c5fd;" +
      "  white-space: nowrap;" +
      "  font-weight: 500;" +
      "  text-align: left;" +
      "}" +
      ".ann-reply-text {" +
      "  color: #fff;" +
      "  word-break: break-all;" +
      "  text-align: left;" +
      "}" +
      ".ann-reply-actions {" +
      "  display: flex;" +
      "  gap: 6px;" +
      "  align-items: center;" +
      "  margin-top: 2px;" +
      "}" +
      ".ann-reply-actions .ann-btn {" +
      "  font-size: 11px;" +
      "  padding: 1px 3px;" +
      "}" +
      /* dialog：顶部与 annotation 对齐 + 一字间隙 + 圆角 5px */
      ".v3d-annotation-dialog {" +
      "  position: absolute !important;" +
      "  top: 0 !important;" +
      "  left: calc(100% + 1em) !important;" +
      "  margin: 0 !important;" +
      "  border-radius: 5px !important;" +
      "  border: 2px solid rgba(255,255,255,0.7) !important;" +
      "  overflow: hidden !important;" +
      "}" +
      /* 悬停时 label 变正方形（不改变尺寸，只改圆角） */
      ".v3d-annotation {" +
      "  transition: border-radius 0.2s ease !important;" +
      "}" +
      ".v3d-annotation.ann-hovered {" +
      "  border-radius: 5px !important;" +
      "}" +
      /* 图片点击放大 */
      ".ann-reply-img {" +
      "  cursor: pointer;" +
      "  transition: opacity 0.15s;" +
      "}" +
      ".ann-reply-img:hover {" +
      "  opacity: 0.75;" +
      "}" +
      ".ann-lightbox {" +
      "  position: fixed;" +
      "  top: 0; left: 0; right: 0; bottom: 0;" +
      "  background: rgba(0,0,0,0.85);" +
      "  display: flex;" +
      "  align-items: center;" +
      "  justify-content: center;" +
      "  z-index: 100000;" +
      "  cursor: pointer;" +
      "}" +
      ".ann-lightbox img {" +
      "  max-width: 90vw;" +
      "  max-height: 90vh;" +
      "  border-radius: 4px;" +
      "  box-shadow: 0 4px 20px rgba(0,0,0,0.5);" +
      "}" +
      ".ann-replies-toggle {" +
      "  background: none;" +
      "  border: none;" +
      "  color: #3b82f6;" +
      "  cursor: pointer;" +
      "  font-size: 11px;" +
      "  padding: 4px 0;" +
      "  width: 100%;" +
      "  text-align: left;" +
      "  transition: color 0.15s;" +
      "}" +
      ".ann-replies-toggle:hover {" +
      "  color: #60a5fa;" +
      "}";
    document.head.appendChild(css);
  })();

  // ==============================
  //  公开 API
  // ==============================

  /**
   * 初始化 annotation 通信桥
   */
  window.setupAnnotationBridge = function (app) {
    if (!app) {
      console.error("[Annotation] setupAnnotationBridge: app is null");
      return;
    }

    // 在 CSS2D 容器上设置 pointer-events 以保证交互
    ensureCSS2DClickable(app);

    window.addEventListener("message", function (event) {
      var msg = event.data;
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case "create-annotation":
          handleCreateAnnotation(app, msg);
          break;
        case "move-annotation":
          handleMoveAnnotation(app, msg);
          break;
        case "update-annotation":
          handleUpdateAnnotation(app, msg);
          break;
        case "remove-annotation":
          handleRemoveAnnotation(app, msg);
          break;
        case "renumber-annotations":
          handleRenumberAnnotations(app, msg);
          break;
        case "start-pick-position":
          handleStartPickPosition(app, msg);
          break;
        case "cancel-pick-position":
          handleCancelPickPosition(app);
          break;
        case "get-marker-position":
          handleGetMarkerPosition(app, msg);
          break;
        case "ping-annotation":
          handlePingAnnotation(app, msg);
          break;
        case "annotation-update-counts":
          handleUpdateCounts(app, msg);
          break;
        case "annotation-add-reply":
          handleAddReply(app, msg);
          break;
        case "annotation-update-reply":
          handleUpdateReply(app, msg);
          break;
        case "show-annotations":
        case "hide-annotations":
          setAllAnnotationsVisible(app, msg.type === "show-annotations");
          break;
        case "show-coordinates":
        case "hide-coordinates":
          setMarkerGroupVisible(app, msg.type === "show-coordinates");
          break;
      }
    });

    // 通知父页面桥已就绪
    try {
      window.parent.postMessage({ type: "annotation-bridge-ready" }, "*");
    } catch (e) {
      console.error("[Annotation] Cannot notify parent:", e);
    }
  };

  /** 确保 CSS2D 容器可点击 */
  function ensureCSS2DClickable(app) {
    if (!app || !app.container) return;
    var selectors = [
      ".v3d-css2d",
      ".v3d-annotation-container",
      ".annotation-container",
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = app.container.querySelector(selectors[i]);
      if (el) {
        el.style.pointerEvents = "none";
        var anns = el.querySelectorAll(".v3d-annotation, .annotation");
        for (var j = 0; j < anns.length; j++) {
          anns[j].style.pointerEvents = "auto";
        }
        break;
      }
    }
  }

  /** 闪烁 annotation（添加动画 class，600ms 后自动移除） */
  function handlePingAnnotation(app, msg) {
    var annotation = annotations[msg.commentId];
    if (!annotation) return;
    var el = annotation.annotation;
    if (!el) return;
    el.classList.remove("annotation-ping");
    void el.offsetWidth;
    el.classList.add("annotation-ping");
    setTimeout(function () {
      el.classList.remove("annotation-ping");
    }, 700);
  }

  // ==============================
  //  内部计数器（基于已存在的 annotation 数量）
  // ==============================
  function getNextLabel() {
    return String(Object.keys(annotations).length + 1);
  }

  // ==============================
  //  Dialog HTML 构建
  // ==============================
  function buildDialogHtml(
    commentId,
    content,
    likes,
    dislikes,
    replyCount,
    replies,
    nickname,
    createdAt,
    images,
  ) {
    likes = typeof likes === "number" ? likes : 0;
    dislikes = typeof dislikes === "number" ? dislikes : 0;
    replyCount = typeof replyCount === "number" ? replyCount : 0;
    replies = replies || [];
    nickname = nickname || "匿名用户";
    if (nickname.length > 8) nickname = nickname.substring(0, 8) + "...";
    images = images || [];
    var dateStr = "";
    if (createdAt) {
      var d = new Date(createdAt);
      var month = String(d.getMonth() + 1).padStart(2, "0");
      var day = String(d.getDate()).padStart(2, "0");
      var hour = String(d.getHours()).padStart(2, "0");
      var min = String(d.getMinutes()).padStart(2, "0");
      dateStr = month + "/" + day + " " + hour + ":" + min;
    }

    // 与侧边栏一致：按点赞降序→时间升序排序，默认只显示最后一条
    var sortedReplies = replies.slice();
    sortedReplies.sort(function (a, b) {
      var likesA = a.likes || 0;
      var likesB = b.likes || 0;
      if (likesB !== likesA) return likesB - likesA;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    var totalReplies = sortedReplies.length;
    var defaultReplies = sortedReplies.slice(-1);

    function buildReplyItemHtml(r) {
      var likedAttr =
        r.likedBy && Array.isArray(r.likedBy) && r.likedBy.length > 0
          ? "true"
          : "false";
      var dislikedAttr =
        r.dislikedBy && Array.isArray(r.dislikedBy) && r.dislikedBy.length > 0
          ? "true"
          : "false";
      var html = '<div class="ann-reply-item">';
      html +=
        '<div class="ann-reply-author">' +
        escapeHtml(r.nickname || "") +
        "</div>";
      html +=
        '<div class="ann-reply-text">' + escapeHtml(r.content || "") + "</div>";
      if (r.images && r.images.length > 0) {
        html +=
          '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">';
        for (var ri = 0; ri < r.images.length; ri++) {
          html += '<img src="' + r.images[ri] + '" class="ann-reply-img" />';
        }
        html += "</div>";
      }
      html +=
        '<div class="ann-reply-actions">' +
        '<button class="ann-btn ann-reply-like" data-comment-id="' +
        r._id +
        '" data-liked="' +
        likedAttr +
        '">' +
        SVG_HEART +
        " " +
        (r.likes || 0) +
        "</button>" +
        '<button class="ann-btn ann-reply-dislike" data-comment-id="' +
        r._id +
        '" data-disliked="' +
        dislikedAttr +
        '">' +
        SVG_DISLIKE +
        " " +
        (r.dislikes || 0) +
        "</button>" +
        '<button class="ann-btn ann-reply-delete" data-comment-id="' +
        r._id +
        '">×</button>' +
        '<button class="ann-btn ann-reply-focus" data-comment-id="' +
        r._id +
        '">···</button>' +
        "</div>";
      html += "</div>";
      return html;
    }

    var repliesHtml = "";
    // 默认只显示最后一条（与侧边栏 slice(-1) 一致）
    for (var di = 0; di < defaultReplies.length; di++) {
      repliesHtml += buildReplyItemHtml(defaultReplies[di]);
    }
    // 多余回复放入隐藏容器
    var extrasHtml = "";
    for (var ei = 0; ei < sortedReplies.length - 1; ei++) {
      extrasHtml += buildReplyItemHtml(sortedReplies[ei]);
    }
    if (extrasHtml) {
      repliesHtml +=
        '<div class="ann-replies-extras" style="display:none">' +
        extrasHtml +
        "</div>";
      repliesHtml +=
        '<button class="ann-replies-toggle" data-expanded="false">共 ' +
        totalReplies +
        " 条回复</button>";
    }

    var imagesHtml = "";
    if (images.length > 0) {
      imagesHtml +=
        '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;margin-bottom:4px">';
      for (var imgi = 0; imgi < images.length; imgi++) {
        imagesHtml +=
          '<img src="' + images[imgi] + '" class="ann-reply-img" />';
      }
      imagesHtml += "</div>";
    }

    return (
      '<div class="ann-hover-card" data-comment-id="' +
      commentId +
      '">' +
      '<div class="ann-dialog-header">' +
      '<div class="ann-dialog-header-top">' +
      '<span class="ann-dialog-nickname">' +
      escapeHtml(nickname) +
      "</span>" +
      '<button class="ann-dialog-close" data-comment-id="' +
      commentId +
      '">x</button>' +
      "</div>" +
      '<span class="ann-dialog-date">' +
      dateStr +
      "</span>" +
      "</div>" +
      '<div class="ann-hover-content">' +
      escapeHtml(content || "") +
      "</div>" +
      imagesHtml +
      '<div class="ann-replies">' +
      repliesHtml +
      "</div>" +
      '<div class="ann-hover-actions">' +
      '<button class="ann-btn ann-like" data-comment-id="' +
      commentId +
      '" data-liked="false">' +
      SVG_HEART +
      " " +
      likes +
      "</button>" +
      '<button class="ann-btn ann-dislike" data-comment-id="' +
      commentId +
      '" data-disliked="false">' +
      SVG_DISLIKE +
      " " +
      dislikes +
      "</button>" +
      '<button class="ann-btn ann-reply" data-comment-id="' +
      commentId +
      '">' +
      SVG_REPLY +
      " " +
      replyCount +
      "</button>" +
      '<button class="ann-btn ann-dialog-focus" data-comment-id="' +
      commentId +
      '">···</button>' +
      "</div>" +
      '<div class="ann-hover-reply" style="display:none">' +
      '<div class="ann-reply-preview" style="display:none"></div>' +
      '<div class="ann-reply-row">' +
      '<input type="file" accept="image/*" class="ann-reply-file" style="display:none" />' +
      '<input type="text" class="ann-reply-input" placeholder="写下回复..." />' +
      '<button class="ann-reply-clip">' +
      SVG_PAPERCLIP +
      "</button>" +
      '<button class="ann-reply-send">发送</button>' +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  // ==============================
  //  悬停/点击交互
  //  悬停：视觉改为 +；点击：Verge3D 原生 toggle dialog，我们同步切换文字
  // ==============================
  /** 为 annotation 添加悬停+点击事件 */
  function addHoverHandlers(annotation, commentId) {
    var label = annotation.annotation;
    if (!label) return;

    var originalChar = annotation.character || "";
    // 从 DOM 读取实际原始字符（某些 Verge3D 版本不暴露 .character 属性）
    var textEl = label.querySelector(".v3d-annotation-text");
    var domChar = textEl ? textEl.textContent : originalChar;
    // 存到 label 的 dataset 上，供 for 循环关闭其他标注时用
    label.dataset.originalChar = domChar;
    // 用 dataset 独立跟踪 dialog 状态（不依赖 Verge3D 内部实现）
    label.dataset.annOpen = "false";

    function setText(text) {
      var textEl = label.querySelector(".v3d-annotation-text");
      if (textEl) {
        textEl.textContent = text;
      } else {
        for (var i = 0; i < label.childNodes.length; i++) {
          var node = label.childNodes[i];
          if (node.nodeType === 3) {
            node.textContent = text;
            break;
          }
        }
      }
    }

    // ---- 悬停：只改视觉 ----
    label.addEventListener("mouseenter", function () {
      if (label.dataset.annOpen === "true") return; // dialog 展开时保持 "−"
      label.classList.add("ann-hovered");
      setText("+");
    });
    label.addEventListener("mouseleave", function () {
      if (label.dataset.annOpen === "true") return;
      label.classList.remove("ann-hovered");
      setText(originalChar);
    });

    // ---- 点击：让 Verge3D toggle dialog，我们自己跟踪状态 ----
    label.addEventListener("click", function (e) {
      e.stopPropagation();
      // 如果当前要打开，先关闭所有其他打开的 annotation
      var nowOpen = label.dataset.annOpen !== "true";
      if (nowOpen) {
        for (var id in annotations) {
          if (annotations.hasOwnProperty(id) && id !== commentId) {
            var other = annotations[id];
            var otherLabel = other.annotation;
            if (otherLabel && otherLabel.dataset.annOpen === "true") {
              otherLabel.dataset.annOpen = "false";
              // 用和 setText 相同的逻辑设置文字（querySelector 找不到时 fallback 到文本节点）
              var oTextEl = otherLabel.querySelector(".v3d-annotation-text");
              if (oTextEl) {
                oTextEl.textContent = otherLabel.dataset.originalChar || "";
              } else {
                for (var ni = 0; ni < otherLabel.childNodes.length; ni++) {
                  var n = otherLabel.childNodes[ni];
                  if (n.nodeType === 3) {
                    n.textContent = otherLabel.dataset.originalChar || "";
                    break;
                  }
                }
              }
              otherLabel.classList.remove("ann-hovered");
            }
          }
        }
      }
      label.dataset.annOpen = nowOpen ? "true" : "false";

      if (nowOpen) {
        setText("−");
        label.classList.add("ann-hovered");
      } else {
        setText(originalChar);
        label.classList.remove("ann-hovered");
      }

      window.parent.postMessage(
        { type: "ping-comment", commentId: commentId },
        "*",
      );
    });
  }

  // ==============================
  //  Dialog 按钮事件委托
  // ==============================
  function addDialogEventDelegation(annotation, commentId) {
    var dialog = annotation.annotationDialog;
    if (!dialog) return;

    annotation._dialogDelegation = function (event) {
      var target = event.target;
      // 如果点了 SVG 图标内部，向上找到按钮
      if (target.tagName === "path" || target.tagName === "svg") {
        var btn = target.closest("button");
        if (btn) target = btn;
      }

      // 点击菜单外部时关闭更多菜单
      var openMenu = dialog.querySelector(".ann-dialog-more-menu");
      if (openMenu) {
        openMenu.remove();
      }

      // ❤ 点赞
      if (target.classList.contains("ann-like")) {
        event.stopPropagation();
        var liked = target.getAttribute("data-liked") === "true";
        var match = target.textContent.match(/\d+/);
        var count = match ? parseInt(match[0], 10) : 0;

        if (liked) {
          target.setAttribute("data-liked", "false");
          target.innerHTML = SVG_HEART + " " + Math.max(0, count - 1);
        } else {
          // 如果之前是踩的状态，清除踩
          var dislikeBtn = dialog.querySelector(".ann-dislike");
          if (
            dislikeBtn &&
            dislikeBtn.getAttribute("data-disliked") === "true"
          ) {
            dislikeBtn.setAttribute("data-disliked", "false");
            var dMatch = dislikeBtn.textContent.match(/\d+/);
            var dCount = dMatch ? parseInt(dMatch[0], 10) : 0;
            dislikeBtn.innerHTML = SVG_DISLIKE + " " + Math.max(0, dCount - 1);
          }
          target.setAttribute("data-liked", "true");
          target.innerHTML = SVG_HEART_FILLED + " " + (count + 1);
        }

        window.parent.postMessage(
          {
            type: "annotation-action",
            action: "like",
            commentId: commentId,
          },
          "*",
        );
        return;
      }

      // 👍 踩
      if (target.classList.contains("ann-dislike")) {
        event.stopPropagation();
        var disliked = target.getAttribute("data-disliked") === "true";
        var match = target.textContent.match(/\d+/);
        var count = match ? parseInt(match[0], 10) : 0;

        if (disliked) {
          target.setAttribute("data-disliked", "false");
          target.innerHTML = SVG_DISLIKE + " " + Math.max(0, count - 1);
        } else {
          // 如果之前是赞的状态，清除赞
          var likeBtn = dialog.querySelector(".ann-like");
          if (likeBtn && likeBtn.getAttribute("data-liked") === "true") {
            likeBtn.setAttribute("data-liked", "false");
            var lMatch = likeBtn.textContent.match(/\d+/);
            var lCount = lMatch ? parseInt(lMatch[0], 10) : 0;
            likeBtn.innerHTML = SVG_HEART + " " + Math.max(0, lCount - 1);
          }
          target.setAttribute("data-disliked", "true");
          target.innerHTML = SVG_DISLIKE + " " + (count + 1);
        }

        window.parent.postMessage(
          {
            type: "annotation-action",
            action: "dislike",
            commentId: commentId,
          },
          "*",
        );
        return;
      }

      // 💬 回复按钮（切换回复输入栏）
      if (target.classList.contains("ann-reply")) {
        event.stopPropagation();
        var replySection = dialog.querySelector(".ann-hover-reply");
        if (!replySection) return;
        if (replySection.style.display === "flex") {
          replySection.style.display = "none";
        } else {
          replySection.style.display = "flex";
          var input = replySection.querySelector(".ann-reply-input");
          if (input) input.focus();
        }
        return;
      }

      // 回复发送按钮
      function sendReply() {
        var replySection = dialog.querySelector(".ann-hover-reply");
        if (!replySection) return;
        var input = replySection.querySelector(".ann-reply-input");
        var preview = replySection.querySelector(".ann-reply-preview");
        var images = [];
        try {
          images = JSON.parse(preview.getAttribute("data-images") || "[]");
        } catch (e) {}
        var text = (input && input.value.trim()) || "";
        if (text || images.length > 0) {
          window.parent.postMessage(
            {
              type: "annotation-action",
              action: "reply",
              commentId: commentId,
              text: text,
              images: images.length > 0 ? images : undefined,
            },
            "*",
          );
          if (input) input.value = "";
          if (preview) {
            preview.removeAttribute("data-images");
            preview.innerHTML = "";
            preview.style.display = "none";
          }
          replySection.style.display = "none";
        }
      }

      // 更新预览 UI
      function updatePreview(images) {
        var preview = dialog.querySelector(".ann-reply-preview");
        if (!preview) return;
        preview.setAttribute("data-images", JSON.stringify(images));
        if (images.length > 0) {
          preview.innerHTML = images
            .map(function (url, i) {
              return (
                '<div class="ann-reply-preview-item">' +
                '<img src="' +
                url +
                '" />' +
                '<button class="ann-reply-img-remove" data-index="' +
                i +
                '">×</button>' +
                "</div>"
              );
            })
            .join("");
          preview.style.display = "flex";
        } else {
          preview.innerHTML = "";
          preview.style.display = "none";
        }
      }

      // 曲别针按钮
      if (target.classList.contains("ann-reply-clip")) {
        event.stopPropagation();
        var fileInput = dialog.querySelector(".ann-reply-file");
        if (fileInput) fileInput.click();
        return;
      }

      // 删除图片预览
      if (target.classList.contains("ann-reply-img-remove")) {
        event.stopPropagation();
        var preview = dialog.querySelector(".ann-reply-preview");
        if (!preview) return;
        var images = [];
        try {
          images = JSON.parse(preview.getAttribute("data-images") || "[]");
        } catch (e) {}
        var idx = parseInt(target.getAttribute("data-index"), 10);
        if (!isNaN(idx) && idx >= 0 && idx < images.length) {
          images.splice(idx, 1);
          updatePreview(images);
        }
        return;
      }

      // 回复发送按钮
      if (target.classList.contains("ann-reply-send")) {
        event.stopPropagation();
        sendReply();
        return;
      }

      // 文件选择处理
      if (target.classList.contains("ann-reply-file")) {
        return; // 由 change 事件处理
      }

      // === 回复按钮：❤ 赞 ===
      if (target.classList.contains("ann-reply-like")) {
        event.stopPropagation();
        var rLiked = target.getAttribute("data-liked") === "true";
        var rMatch = target.textContent.match(/\d+/);
        var rCount = rMatch ? parseInt(rMatch[0], 10) : 0;
        if (rLiked) {
          target.setAttribute("data-liked", "false");
          target.innerHTML = SVG_HEART + " " + Math.max(0, rCount - 1);
        } else {
          // 如果已踩，清除踩
          var parentItem = target.closest(".ann-reply-item");
          if (parentItem) {
            var rDislike = parentItem.querySelector(".ann-reply-dislike");
            if (rDislike && rDislike.getAttribute("data-disliked") === "true") {
              rDislike.setAttribute("data-disliked", "false");
              var rdMatch = rDislike.textContent.match(/\d+/);
              var rdCount = rdMatch ? parseInt(rdMatch[0], 10) : 0;
              rDislike.innerHTML = SVG_DISLIKE + " " + Math.max(0, rdCount - 1);
            }
          }
          target.setAttribute("data-liked", "true");
          target.innerHTML = SVG_HEART_FILLED + " " + (rCount + 1);
        }
        window.parent.postMessage(
          {
            type: "annotation-action",
            action: "like-reply",
            commentId: target.getAttribute("data-comment-id"),
          },
          "*",
        );
        return;
      }

      // === 回复按钮：👍 踩 ===
      if (target.classList.contains("ann-reply-dislike")) {
        event.stopPropagation();
        var rDisliked = target.getAttribute("data-disliked") === "true";
        var rdMatch = target.textContent.match(/\d+/);
        var rdCount = rdMatch ? parseInt(rdMatch[0], 10) : 0;
        if (rDisliked) {
          target.setAttribute("data-disliked", "false");
          target.innerHTML = SVG_DISLIKE + " " + Math.max(0, rdCount - 1);
        } else {
          var parentItem = target.closest(".ann-reply-item");
          if (parentItem) {
            var rLike = parentItem.querySelector(".ann-reply-like");
            if (rLike && rLike.getAttribute("data-liked") === "true") {
              rLike.setAttribute("data-liked", "false");
              var rlMatch = rLike.textContent.match(/\d+/);
              var rlCount = rlMatch ? parseInt(rlMatch[0], 10) : 0;
              rLike.innerHTML = SVG_HEART + " " + Math.max(0, rlCount - 1);
            }
          }
          target.setAttribute("data-disliked", "true");
          target.innerHTML = SVG_DISLIKE + " " + (rdCount + 1);
        }
        window.parent.postMessage(
          {
            type: "annotation-action",
            action: "dislike-reply",
            commentId: target.getAttribute("data-comment-id"),
          },
          "*",
        );
        return;
      }

      // === 回复按钮：× 删除 ===
      if (target.classList.contains("ann-reply-delete")) {
        event.stopPropagation();
        window.parent.postMessage(
          {
            type: "annotation-action",
            action: "delete-reply",
            commentId: target.getAttribute("data-comment-id"),
          },
          "*",
        );
        return;
      }

      // === 回复按钮：··· 聚焦侧边栏 ===
      if (target.classList.contains("ann-reply-focus")) {
        event.stopPropagation();
        var rfFocused = target.getAttribute("data-focus-active") === "true";
        if (rfFocused) {
          target.setAttribute("data-focus-active", "false");
          window.parent.postMessage(
            {
              type: "annotation-action",
              action: "unfocus-comment",
              commentId: target.getAttribute("data-comment-id"),
            },
            "*",
          );
        } else {
          target.setAttribute("data-focus-active", "true");
          window.parent.postMessage(
            {
              type: "annotation-action",
              action: "focus-comment",
              commentId: target.getAttribute("data-comment-id"),
            },
            "*",
          );
        }
        return;
      }

      // === 回复展开/收起按钮 ===
      if (target.classList.contains("ann-replies-toggle")) {
        event.stopPropagation();
        var expanded = target.getAttribute("data-expanded") === "true";
        var extras = dialog.querySelector(".ann-replies-extras");
        if (extras) {
          extras.style.display = expanded ? "none" : "block";
        }
        target.setAttribute("data-expanded", expanded ? "false" : "true");
        // 更新按钮文字
        var total = dialog.querySelectorAll(".ann-reply-item").length;
        if (expanded) {
          var hiddenCount = total - 1;
          target.textContent = "共 " + total + " 条回复";
        } else {
          target.textContent = "收起回复";
        }
        return;
      }

      // 图片点击放大
      if (target.classList.contains("ann-reply-img")) {
        event.stopPropagation();
        var src = target.getAttribute("src");
        if (src) {
          var overlay = document.createElement("div");
          overlay.className = "ann-lightbox";
          var img = document.createElement("img");
          img.src = src;
          overlay.appendChild(img);
          overlay.addEventListener("click", function () {
            document.body.removeChild(overlay);
          });
          document.body.appendChild(overlay);
        }
        return;
      }

      // 关闭按钮（隐藏 dialog + 更新 Verge3D 内部状态）
      if (target.classList.contains("ann-dialog-close")) {
        event.stopPropagation();
        var closeLabel = annotation.annotation;
        if (closeLabel) {
          closeLabel.dataset.annOpen = "false";
          var ctEl = closeLabel.querySelector(".v3d-annotation-text");
          if (ctEl) {
            ctEl.textContent = closeLabel.dataset.originalChar || "";
          } else {
            for (var cni = 0; cni < closeLabel.childNodes.length; cni++) {
              var cn = closeLabel.childNodes[cni];
              if (cn.nodeType === 3) {
                cn.textContent = closeLabel.dataset.originalChar || "";
                break;
              }
            }
          }
          closeLabel.classList.remove("ann-hovered");
        }
        // 同步 Verge3D 内部状态，防止渲染循环恢复可见
        annotation.annotationDialogVisible = false;
        dialog.style.visibility = "hidden";
        return;
      }

      // ··· 按钮（切换侧边栏展开/折叠）
      if (target.classList.contains("ann-dialog-focus")) {
        event.stopPropagation();
        var focused = target.getAttribute("data-focus-active") === "true";
        if (focused) {
          target.setAttribute("data-focus-active", "false");
          window.parent.postMessage(
            {
              type: "annotation-action",
              action: "unfocus-comment",
              commentId: commentId,
            },
            "*",
          );
        } else {
          target.setAttribute("data-focus-active", "true");
          window.parent.postMessage(
            {
              type: "annotation-action",
              action: "focus-comment",
              commentId: commentId,
            },
            "*",
          );
        }
        return;
      }
    };

    dialog.addEventListener("click", annotation._dialogDelegation);

    // 回复输入框 Enter 键 + Paste
    annotation._replyKeyHandler = function (event) {
      if (event.key === "Enter") {
        var replySection = dialog.querySelector(".ann-hover-reply");
        if (!replySection) return;
        var input = replySection.querySelector(".ann-reply-input");
        var preview = replySection.querySelector(".ann-reply-preview");
        var images = [];
        try {
          images = JSON.parse(preview.getAttribute("data-images") || "[]");
        } catch (e) {}
        if ((input && input.value.trim()) || images.length > 0) {
          sendReply();
        }
      }
    };
    annotation._replyPasteHandler = function (event) {
      var items = event.clipboardData && event.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") === 0) {
          event.preventDefault();
          var file = items[i].getAsFile();
          if (!file) return;
          var preview = dialog.querySelector(".ann-reply-preview");
          if (!preview) return;
          var images = [];
          try {
            images = JSON.parse(preview.getAttribute("data-images") || "[]");
          } catch (e) {}
          if (images.length >= 2) return;
          compressImage(file, null, function (dataUrl) {
            if (dataUrl) {
              images.push(dataUrl);
              updatePreview(images);
            }
          });
          return;
        }
      }
    };

    var replyInput = dialog.querySelector(".ann-reply-input");
    if (replyInput) {
      replyInput.addEventListener("keydown", annotation._replyKeyHandler);
      replyInput.addEventListener("paste", annotation._replyPasteHandler);
    }

    // 文件选择 → 压缩 → 预览（支持 2 张）
    var fileInput = dialog.querySelector(".ann-reply-file");
    if (fileInput) {
      annotation._fileChangeHandler = function (e) {
        var files = e.target.files;
        if (!files || files.length === 0) return;
        var preview = dialog.querySelector(".ann-reply-preview");
        if (!preview) return;
        var images = [];
        try {
          images = JSON.parse(preview.getAttribute("data-images") || "[]");
        } catch (e) {}
        // 处理每个文件，最多到 2 张
        for (var fi = 0; fi < files.length && images.length < 2; fi++) {
          (function (file) {
            if (!file) return;
            compressImage(file, null, function (dataUrl) {
              if (dataUrl && images.length < 2) {
                images.push(dataUrl);
                updatePreview(images);
              }
            });
          })(files[fi]);
        }
        e.target.value = "";
      };
      fileInput.addEventListener("change", annotation._fileChangeHandler);
    }
  }

  // ==============================
  //  清除 annotation 的事件监听
  // ==============================
  function removeAnnotationListeners(annotation) {
    if (annotation._hideTimer) {
      clearTimeout(annotation._hideTimer);
      annotation._hideTimer = null;
    }

    var dialog = annotation.annotationDialog;
    if (dialog) {
      if (annotation._dialogDelegation) {
        dialog.removeEventListener("click", annotation._dialogDelegation);
        annotation._dialogDelegation = null;
      }
      var replyInput = dialog.querySelector(".ann-reply-input");
      if (replyInput && annotation._replyKeyHandler) {
        replyInput.removeEventListener("keydown", annotation._replyKeyHandler);
        annotation._replyKeyHandler = null;
      }
      if (replyInput && annotation._replyPasteHandler) {
        replyInput.removeEventListener("paste", annotation._replyPasteHandler);
        annotation._replyPasteHandler = null;
      }
      var fileInput = dialog.querySelector(".ann-reply-file");
      if (fileInput && annotation._fileChangeHandler) {
        fileInput.removeEventListener("change", annotation._fileChangeHandler);
        annotation._fileChangeHandler = null;
      }
    }
  }

  // ==============================
  //  创建
  // ==============================
  function handleCreateAnnotation(app, msg) {
    if (!msg.commentId || !msg.position) return;

    // 如果已存在，只更新位置
    if (annotations[msg.commentId]) {
      annotations[msg.commentId].position.set(
        msg.position.x,
        msg.position.y,
        msg.position.z,
      );
      return;
    }

    try {
      var label = getNextLabel();
      var dialog = buildDialogHtml(
        msg.commentId,
        msg.content,
        msg.likes,
        msg.dislikes,
        msg.replyCount,
        msg.replies,
        msg.nickname,
        msg.createdAt,
        msg.images,
      );

      var annotation = new v3d.Annotation(app.container, label, dialog);

      // 关闭遮挡淡出，确保穿透透明物体
      annotation.fadeObscured = false;

      // 强制 annotation 标签元素可点击
      if (annotation.annotation) {
        annotation.annotation.style.setProperty(
          "pointer-events",
          "auto",
          "important",
        );
        annotation.annotation.style.setProperty("z-index", "9999", "important");
      }

      annotation.position.set(msg.position.x, msg.position.y, msg.position.z);
      app.scene.add(annotation);

      annotations[msg.commentId] = annotation;

      addHoverHandlers(annotation, msg.commentId);
      addDialogEventDelegation(annotation, msg.commentId);
    } catch (e) {
      console.error("[Annotation] Create failed:", e);
    }
  }

  // ==============================
  //  移动
  // ==============================
  function handleMoveAnnotation(app, msg) {
    var annotation = annotations[msg.commentId];
    if (!annotation) return;
    annotation.position.set(msg.position.x, msg.position.y, msg.position.z);
  }

  // ==============================
  //  更新内容
  // ==============================
  function handleUpdateAnnotation(app, msg) {
    var annotation = annotations[msg.commentId];
    if (!annotation) return;

    try {
      if (annotation.annotationDialog) {
        // 更新 dialog 内的 .ann-hover-content
        var contentEl =
          annotation.annotationDialog.querySelector(".ann-hover-content");
        if (contentEl) {
          contentEl.innerHTML = escapeHtml(msg.content || "");
        } else {
          // 兼容旧结构：直接替换整个 dialog 内容
          annotation.annotationDialog.innerHTML = escapeHtml(msg.content || "");
        }
        annotation.dialogContents = msg.content || "";

        // 如果提供了 counts，同步更新按钮显示
        if (typeof msg.likes === "number") {
          var likeBtn = annotation.annotationDialog.querySelector(".ann-like");
          if (likeBtn) {
            var liked = likeBtn.getAttribute("data-liked") === "true";
            likeBtn.innerHTML =
              (liked ? SVG_HEART_FILLED : SVG_HEART) + " " + msg.likes;
          }
        }
        if (typeof msg.dislikes === "number") {
          var dislikeBtn =
            annotation.annotationDialog.querySelector(".ann-dislike");
          if (dislikeBtn) {
            dislikeBtn.innerHTML = SVG_DISLIKE + " " + msg.dislikes;
          }
        }
        if (typeof msg.replyCount === "number") {
          var replyBtn =
            annotation.annotationDialog.querySelector(".ann-reply");
          if (replyBtn) {
            replyBtn.innerHTML = SVG_REPLY + " " + msg.replyCount;
          }
        }
      } else {
        var pos = annotation.position.clone();
        var label = annotation.character || getNextLabel();
        removeAnnotationListeners(annotation);
        app.scene.remove(annotation);
        delete annotations[msg.commentId];

        var dialog = buildDialogHtml(
          msg.commentId,
          msg.content,
          msg.likes,
          msg.dislikes,
          msg.replyCount,
          msg.replies,
          msg.nickname,
          msg.createdAt,
          msg.images,
        );

        var newAnn = new v3d.Annotation(app.container, label, dialog);
        newAnn.fadeObscured = false;
        newAnn.position.copy(pos);
        app.scene.add(newAnn);
        annotations[msg.commentId] = newAnn;
        addHoverHandlers(newAnn, msg.commentId);
        addDialogEventDelegation(newAnn, msg.commentId);
      }
    } catch (e) {
      console.error("[Annotation] Update failed:", e);
    }
  }

  // ==============================
  //  更新 counts（like/dislike/reply 同步）
  // ==============================
  function handleUpdateCounts(app, msg) {
    var annotation = annotations[msg.commentId];
    if (!annotation) return;
    if (!annotation.annotationDialog) return;

    if (typeof msg.likes === "number") {
      var likeBtn = annotation.annotationDialog.querySelector(".ann-like");
      if (likeBtn) {
        var liked =
          msg.userLiked === true ||
          likeBtn.getAttribute("data-liked") === "true";
        likeBtn.innerHTML =
          (liked ? SVG_HEART_FILLED : SVG_HEART) + " " + msg.likes;
        if (typeof msg.userLiked === "boolean") {
          likeBtn.setAttribute("data-liked", String(msg.userLiked));
        }
      }
    }
    if (typeof msg.dislikes === "number") {
      var dislikeBtn =
        annotation.annotationDialog.querySelector(".ann-dislike");
      if (dislikeBtn) {
        dislikeBtn.innerHTML = SVG_DISLIKE + " " + msg.dislikes;
        if (typeof msg.userDisliked === "boolean") {
          dislikeBtn.setAttribute("data-disliked", String(msg.userDisliked));
        }
      }
    }
    if (typeof msg.replyCount === "number") {
      var replyBtn = annotation.annotationDialog.querySelector(".ann-reply");
      if (replyBtn) {
        replyBtn.innerHTML = SVG_REPLY + " " + msg.replyCount;
      }
    }
  }

  // ==============================
  //  添加回复（同步到 dialog 内显示）
  // ==============================
  function handleAddReply(app, msg) {
    var annotation = annotations[msg.commentId];
    if (!annotation) return;
    if (!annotation.annotationDialog) return;

    var repliesContainer =
      annotation.annotationDialog.querySelector(".ann-replies");
    if (!repliesContainer) return;

    // 创建新回复项
    var replyItem = document.createElement("div");
    replyItem.className = "ann-reply-item";
    var innerHtml =
      '<div class="ann-reply-author">' +
      escapeHtml(msg.nickname || "") +
      "</div>" +
      '<div class="ann-reply-text">' +
      escapeHtml(msg.content || "") +
      "</div>";
    if (msg.images && msg.images.length > 0) {
      innerHtml +=
        '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">';
      for (var ii = 0; ii < msg.images.length; ii++) {
        innerHtml +=
          '<img src="' + msg.images[ii] + '" class="ann-reply-img" />';
      }
      innerHtml += "</div>";
    }
    innerHtml +=
      '<div class="ann-reply-actions">' +
      '<button class="ann-btn ann-reply-like" data-comment-id="' +
      msg._id +
      '" data-liked="false">' +
      SVG_HEART +
      " 0</button>" +
      '<button class="ann-btn ann-reply-dislike" data-comment-id="' +
      msg._id +
      '" data-disliked="false">' +
      SVG_DISLIKE +
      " 0</button>" +
      '<button class="ann-btn ann-reply-delete" data-comment-id="' +
      msg._id +
      '">×</button>' +
      '<button class="ann-btn ann-reply-focus" data-comment-id="' +
      msg._id +
      '">···</button>' +
      "</div>";
    replyItem.innerHTML = innerHtml;

    // 检查折叠状态：有 .ann-replies-extras 表示已折叠
    var extras = repliesContainer.querySelector(".ann-replies-extras");
    var toggle = repliesContainer.querySelector(".ann-replies-toggle");

    if (extras) {
      // 折叠状态 → 新回复放入 extras（保持隐藏）
      extras.appendChild(replyItem);
    } else if (toggle) {
      // 有 toggle 但无 extras（异常状态），直接追加
      repliesContainer.insertBefore(replyItem, toggle);
    } else {
      // 无折叠系统：直接追加到末尾
      repliesContainer.appendChild(replyItem);
      // 如果已有 2 条回复，创建折叠系统（与初始 buildDialogHtml 行为一致）
      var allItems = repliesContainer.querySelectorAll(".ann-reply-item");
      if (allItems.length >= 2) {
        var newExtras = document.createElement("div");
        newExtras.className = "ann-replies-extras";
        newExtras.style.display = "none";
        // 把所有回复（除了最后一条）移入 extras
        for (var ei = 0; ei < allItems.length - 1; ei++) {
          newExtras.appendChild(allItems[ei]);
        }
        repliesContainer.insertBefore(newExtras, null);
        // 创建 toggle 按钮
        var newToggle = document.createElement("button");
        newToggle.className = "ann-replies-toggle";
        newToggle.setAttribute("data-expanded", "false");
        newToggle.textContent = "共 " + allItems.length + " 条回复";
        repliesContainer.appendChild(newToggle);
        // 更新 toggle 变量引用，后续用同一变量更新文字
        toggle = newToggle;
      }
    }

    // 更新 toggle 按钮文字
    toggle = toggle || repliesContainer.querySelector(".ann-replies-toggle");
    if (toggle) {
      var total = repliesContainer.querySelectorAll(".ann-reply-item").length;
      toggle.textContent = "共 " + total + " 条回复";
    }

    // 同步更新主回复按钮计数
    if (typeof msg.replyCount === "number") {
      var replyBtn = annotation.annotationDialog.querySelector(".ann-reply");
      if (replyBtn) {
        replyBtn.innerHTML = SVG_REPLY + " " + msg.replyCount;
      }
    }
  }

  // ==============================
  //  更新回复计数（赞/踩同步）
  // ==============================
  function handleUpdateReply(app, msg) {
    var annotation = annotations[msg.commentId];
    if (!annotation) return;
    if (!annotation.annotationDialog) return;

    var repliesContainer =
      annotation.annotationDialog.querySelector(".ann-replies");
    if (!repliesContainer) return;

    // 找到对应的回复条目
    var items = repliesContainer.querySelectorAll(".ann-reply-item");
    for (var ri = 0; ri < items.length; ri++) {
      var item = items[ri];
      var likeBtn = item.querySelector(".ann-reply-like");
      var dislikeBtn = item.querySelector(".ann-reply-dislike");
      if (!likeBtn) continue;

      var btnCommentId = likeBtn.getAttribute("data-comment-id");
      if (btnCommentId !== msg.replyId) continue;

      // 更新赞
      if (typeof msg.likes === "number") {
        var liked =
          msg.userLiked === true ||
          likeBtn.getAttribute("data-liked") === "true";
        likeBtn.innerHTML =
          (liked ? SVG_HEART_FILLED : SVG_HEART) + " " + msg.likes;
        if (typeof msg.userLiked === "boolean") {
          likeBtn.setAttribute("data-liked", String(msg.userLiked));
        }
      }
      // 更新踩
      if (typeof msg.dislikes === "number") {
        var disliked =
          msg.userDisliked === true ||
          dislikeBtn.getAttribute("data-disliked") === "true";
        dislikeBtn.innerHTML = SVG_DISLIKE + " " + msg.dislikes;
        if (typeof msg.userDisliked === "boolean") {
          dislikeBtn.setAttribute("data-disliked", String(msg.userDisliked));
        }
      }
      break;
    }
  }

  // ==============================
  //  删除
  // ==============================
  function handleRemoveAnnotation(app, msg) {
    var annotation = annotations[msg.commentId];
    if (!annotation) return;

    removeAnnotationListeners(annotation);
    removeAnnotationDOM(annotation);

    app.scene.remove(annotation);
    delete annotations[msg.commentId];

    try {
      window.parent.postMessage(
        { type: "annotation-removed", commentId: msg.commentId },
        "*",
      );
    } catch (e) {
      console.error("[Annotation] Failed to notify parent on remove:", e);
    }
  }

  // ==============================
  //  重新编号（删除标定后调用）
  // ==============================
  function handleRenumberAnnotations(app, msg) {
    var list = msg.annotations;
    if (!list || !list.length) {
      // 没有剩余 annotation，全部清除
      clearAllAnnotations(app);
      return;
    }

    // 1. 清除所有现有 annotation
    clearAllAnnotations(app);

    // 2. 按顺序重建，用新的顺序编号
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item.commentId || !item.position) continue;

      try {
        var label = String(i + 1);
        var dialog = buildDialogHtml(
          item.commentId,
          item.content,
          item.likes,
          item.dislikes,
          item.replyCount,
          item.replies,
          item.nickname,
          item.createdAt,
          item.images,
        );

        var annotation = new v3d.Annotation(app.container, label, dialog);
        annotation.fadeObscured = false;
        if (annotation.annotation) {
          annotation.annotation.style.setProperty(
            "pointer-events",
            "auto",
            "important",
          );
        }
        annotation.position.set(
          item.position.x,
          item.position.y,
          item.position.z,
        );
        app.scene.add(annotation);

        annotations[item.commentId] = annotation;
        addHoverHandlers(annotation, item.commentId);
        addDialogEventDelegation(annotation, item.commentId);
      } catch (e) {
        console.error("[Annotation] Rebuild failed for", item.commentId, e);
      }
    }
  }

  /** 清除所有 annotation */
  function clearAllAnnotations(app) {
    for (var key in annotations) {
      if (annotations.hasOwnProperty(key)) {
        removeAnnotationListeners(annotations[key]);
        removeAnnotationDOM(annotations[key]);
        app.scene.remove(annotations[key]);
      }
    }
    for (var k in annotations) {
      if (annotations.hasOwnProperty(k)) {
        delete annotations[k];
      }
    }
  }

  /** 显示/隐藏所有 annotation */
  function setAllAnnotationsVisible(app, visible) {
    for (var key in annotations) {
      if (annotations.hasOwnProperty(key)) {
        var ann = annotations[key];
        ann.visible = visible;
      }
    }
  }

  /** 显示/隐藏标记组（优先查找"标记"Group，回退到标记X/标记Y/标记Z） */
  var _markerGroupVisible = true;
  function setMarkerGroupVisible(app, visible) {
    _markerGroupVisible = visible;

    // 优先查找"标记"Group
    var group = app.scene.getObjectByName("标记");
    if (group) {
      group.visible = visible;
      return;
    }

    // 回退：逐个控制 标记X/标记Y/标记Z
    var markerNames = ["标记X", "标记Y", "标记Z"];
    for (var i = 0; i < markerNames.length; i++) {
      var obj = app.scene.getObjectByName(markerNames[i]);
      if (obj) {
        obj.visible = visible;
      }
    }
  }

  /** 从 DOM 中移除 annotation 的 CSS2D 元素 */
  function removeAnnotationDOM(annotation) {
    try {
      if (annotation.annotation && annotation.annotation.parentNode) {
        annotation.annotation.parentNode.removeChild(annotation.annotation);
      }
    } catch (e) {
      console.error("[Annotation] removeAnnotationDOM error:", e);
    }
  }

  // ==============================
  //  拾取坐标模式
  // ==============================
  function handleStartPickPosition(app, msg) {
    handleCancelPickPosition(app);

    pickState = { commentId: msg.commentId };

    var canvas = app.renderer && app.renderer.domElement;
    if (!canvas) {
      console.error("[Annotation] No canvas found");
      pickState = null;
      return;
    }
    canvas.style.cursor = "crosshair";

    pickState.onClick = function (event) {
      if (!pickState) return;

      var rect = canvas.getBoundingClientRect();
      var mouse = new v3d.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );

      var raycaster = new v3d.Raycaster();
      raycaster.setFromCamera(mouse, app.camera);

      var intersects = raycaster.intersectObjects(app.scene.children, true);

      if (intersects.length > 0) {
        var hit = intersects[0];
        var point = hit.point;

        try {
          window.parent.postMessage(
            {
              type: "position-picked",
              commentId: pickState.commentId,
              position: { x: point.x, y: point.y, z: point.z },
            },
            "*",
          );
        } catch (e) {
          console.error("[Annotation] Failed to send position-picked:", e);
        }

        handleCancelPickPosition(app);
      }
    };

    canvas.addEventListener("click", pickState.onClick);
  }

  function handleCancelPickPosition(app) {
    if (!pickState) return;

    var canvas = app.renderer && app.renderer.domElement;
    if (canvas) {
      canvas.style.cursor = "default";
      if (pickState.onClick) {
        canvas.removeEventListener("click", pickState.onClick);
      }
    }

    pickState = null;
  }

  // ==============================
  //  获取标记位置
  // ==============================
  function handleGetMarkerPosition(app, msg) {
    var pos = null;
    try {
      if (
        app.ExternalInterface &&
        typeof app.ExternalInterface.getMarkerPosition === "function"
      ) {
        pos = app.ExternalInterface.getMarkerPosition();
      }
    } catch (e) {
      console.error("[Annotation] getMarkerPosition error:", e);
    }

    if (pos && typeof pos.x === "number") {
      window.parent.postMessage(
        {
          type: "marker-position",
          commentId: msg.commentId,
          position: { x: pos.x, y: pos.y, z: pos.z },
        },
        "*",
      );
    } else {
      handleStartPickPosition(app, msg);
    }
  }

  // ==============================
  //  恢复
  // ==============================
  window.restoreAnnotations = function (app, comments) {
    if (!comments || !comments.length) return;
    comments.forEach(function (c) {
      handleCreateAnnotation(app, {
        commentId: c.commentId,
        position: c.position,
        content: c.content,
        likes: c.likes,
        dislikes: c.dislikes,
        replyCount: c.replyCount,
        replies: c.replies,
        nickname: c.nickname,
        createdAt: c.createdAt,
      });
    });
  };

  // ==============================
  //  SVG 图标常量（Lucide 风格）
  // ==============================
  var SVG_HEART =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  var SVG_HEART_FILLED =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  var SVG_DISLIKE =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>';
  var SVG_REPLY =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var SVG_PAPERCLIP =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';

  // ==============================
  //  工具函数
  // ==============================
  function escapeHtml(str) {
    var d = document.createElement("div");
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  /** 将图片文件压缩为 base64 缩略图（目标 <20KB） */
  function compressImage(file, maxBytes, callback) {
    maxBytes = maxBytes || 20 * 1024;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.width,
          h = img.height;
        var MAX_W = 240;
        if (w > MAX_W) {
          h = Math.round(h * (MAX_W / w));
          w = MAX_W;
        }
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);

        // 尝试质量 0.7
        var quality = 0.7;
        var result = canvas.toDataURL("image/jpeg", quality);
        if (result.length > maxBytes) {
          // 二分法找合适质量
          var lo = 0.1,
            hi = 0.7;
          for (var i = 0; i < 8; i++) {
            quality = (lo + hi) / 2;
            result = canvas.toDataURL("image/jpeg", quality);
            if (result.length > maxBytes) {
              hi = quality;
            } else {
              lo = quality;
            }
          }
        }
        callback(result);
      };
      img.onerror = function () {
        callback(null);
      };
      img.src = reader.result;
    };
    reader.onerror = function () {
      callback(null);
    };
    reader.readAsDataURL(file);
  }
})();
