/**
 * markder-drag.js - Verge3D 标记物体轴约束拖拽功能（共用函数）
 *
 * 用法：
 *   1. 在 HTML 中通过 <script src="marker-drag.js"></script> 引入
 *   2. 场景加载完成后调用：
 *        const drag = setupDraggableMarker(app);
 *   3. 可选暴露接口：
 *        app.ExternalInterface.resetMarkerPosition = function() {
 *            drag.resetPosition();
 *        };
 *        app.ExternalInterface.getMarkerPosition = function() {
 *            const m = drag.getMarker();
 *            return m ? { x: m.x, y: m.y, z: m.z } : null;
 *        };
 *
 * 要求：
 *   - 3D 场景中有三个独立 Mesh 节点：标记X、标记Y、标记Z
 *   - 依赖 v3d 全局对象（v3d.js）
 *   - 依赖 localStorage（位置自动保存和恢复）
 */

function setupDraggableMarker(app) {
  const STORAGE_KEY = "v3d_marker_position";
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

  // ---- 查找"标记X/Y/Z"三个独立节点 ----
  function findMarkers() {
    markerObjects.x = app.scene.getObjectByName("标记X");
    markerObjects.y = app.scene.getObjectByName("标记Y");
    markerObjects.z = app.scene.getObjectByName("标记Z");
    if (markerObjects.x && markerObjects.y && markerObjects.z) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const pos = JSON.parse(saved);
          setAllPositions(pos.x, pos.y, pos.z);
        } catch (e) {}
      }
    } else {
      setTimeout(findMarkers, 1000);
    }
  }

  // ---- 同时设置三个标记的位置 ----
  function setAllPositions(x, y, z) {
    if (markerObjects.x) {
      markerObjects.x.position.set(x, y, z);
    }
    if (markerObjects.y) {
      markerObjects.y.position.set(x, y, z);
    }
    if (markerObjects.z) {
      markerObjects.z.position.set(x, y, z);
    }
  }

  // ---- 获取三个标记的当前位置（以X为准） ----
  function getGroupPosition() {
    return markerObjects.x
      ? markerObjects.x.position.clone()
      : new v3d.Vector3();
  }

  // 等待场景就绪后再查找标记
  if (app.scene) {
    findMarkers();
  } else {
    var checkTimer = setInterval(function () {
      if (app.scene) {
        clearInterval(checkTimer);
        findMarkers();
      }
    }, 200);
  }

  // ---- 工具：获取指针位置归一化坐标 ----
  function getPointerNDC(e) {
    const rect = domElement.getBoundingClientRect();
    const x = (((e.clientX || e.pageX) - rect.left) / rect.width) * 2 - 1;
    const y = (-((e.clientY || e.pageY) - rect.top) / rect.height) * 2 + 1;
    return { x, y };
  }

  // ---- 检测点击到哪个轴标记 ----
  function hitTestAxis(ndc) {
    const targets = [];
    if (markerObjects.x) targets.push(markerObjects.x);
    if (markerObjects.y) targets.push(markerObjects.y);
    if (markerObjects.z) targets.push(markerObjects.z);
    if (targets.length === 0) return null;

    mouse.set(ndc.x, ndc.y);
    raycaster.setFromCamera(mouse, app.camera);
    const intersects = raycaster.intersectObjects(targets, false);

    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      if (hitObj.name === "标记X")
        return { axis: "x", point: intersects[0].point };
      if (hitObj.name === "标记Y")
        return { axis: "y", point: intersects[0].point };
      if (hitObj.name === "标记Z")
        return { axis: "z", point: intersects[0].point };
    }
    return null;
  }

  // ---- 指针按下（捕获阶段拦截，先于控制器触发） ----
  function onPointerDownCapture(e) {
    if (!markerObjects.x || !markerObjects.y || !markerObjects.z) return;

    if (buttonAxis) {
      e.stopPropagation();
      e.preventDefault();
      domElement.setPointerCapture(e.pointerId);
      capturedPointerId = e.pointerId;
      isDragging = true;
      activeAxis = buttonAxis;
      domElement.style.cursor = "grabbing";
      if (app.controls) {
        app.controls.enabled = false;
      }
      groupStartPos.copy(getGroupPosition());
      hitPoint.copy(getGroupPosition());

      // 计算鼠标当前位置在轴线上的参数 t0，用于增量拖拽
      var _ndc = getPointerNDC(e);
      mouse.set(_ndc.x, _ndc.y);
      raycaster.setFromCamera(mouse, app.camera);
      var _axisDir = getAxisDir();
      var _rayOrigin = raycaster.ray.origin;
      var _rayDir = raycaster.ray.direction;
      var _cross1 = new v3d.Vector3().crossVectors(_rayDir, _axisDir);
      var _denom = _cross1.dot(_cross1);
      if (_denom >= 0.0001) {
        var _w = new v3d.Vector3().copy(_rayOrigin).sub(hitPoint);
        var _cross2 = new v3d.Vector3().crossVectors(_rayDir, _cross1);
        initialAxisOffset = _w.dot(_cross2) / _denom;
      } else {
        initialAxisOffset = 0;
      }

      var _refDist = hitPoint.distanceTo(app.camera.position);
      var _fovRad = (app.camera.fov * Math.PI) / 180;
      var _halfHeight = _refDist * Math.tan(_fovRad / 2);
      var _halfWidth = _halfHeight * app.camera.aspect;
      viewBounds = {
        yMin: 0,
        yMax: _halfHeight * 0.9,
        xMax: _halfWidth * 0.9,
        zMax: _halfWidth * 0.9,
      };
      return;
    }

    const ndc = getPointerNDC(e);
    const hit = hitTestAxis(ndc);
    if (!hit) return;

    e.stopPropagation();
    e.preventDefault();

    domElement.setPointerCapture(e.pointerId);
    capturedPointerId = e.pointerId;

    isDragging = true;
    activeAxis = hit.axis;
    domElement.style.cursor = "grabbing";

    if (app.controls) {
      app.controls.enabled = false;
    }

    groupStartPos.copy(getGroupPosition());
    hitPoint.copy(hit.point);

    // 计算参考距离的视锥边界（以 hitPoint 到摄像机的距离为基准）
    const refDist = hitPoint.distanceTo(app.camera.position);
    const fovRad = (app.camera.fov * Math.PI) / 180;
    const halfHeight = refDist * Math.tan(fovRad / 2);
    const halfWidth = halfHeight * app.camera.aspect;
    viewBounds = {
      yMin: 0,
      yMax: halfHeight * 0.9,
      xMax: halfWidth * 0.9,
      zMax: halfWidth * 0.9,
    };
  }

  // ---- 获取轴方向向量（世界坐标） ----
  function getAxisDir() {
    if (activeAxis === "x") return new v3d.Vector3(1, 0, 0);
    if (activeAxis === "y") return new v3d.Vector3(0, 0, 1);
    if (activeAxis === "z") return new v3d.Vector3(0, 1, 0);
    return new v3d.Vector3();
  }

  // ---- 获取轴移动符号 ----
  function getAxisSign() {
    if (activeAxis === "x") return -1;
    if (activeAxis === "y") return -1;
    if (activeAxis === "z") return -1;
    return 1;
  }

  // ---- 指针移动（轴约束追踪法） ----
  function onPointerMoveCapture(e) {
    if (!isDragging || !activeAxis) return;

    e.stopPropagation();
    e.preventDefault();

    const ndc = getPointerNDC(e);
    mouse.set(ndc.x, ndc.y);
    raycaster.setFromCamera(mouse, app.camera);

    const axisDir = getAxisDir();
    const rayOrigin = raycaster.ray.origin;
    const rayDir = raycaster.ray.direction;

    // 计算鼠标射线到轴线的最近点
    const cross1 = new v3d.Vector3().crossVectors(rayDir, axisDir);
    const denom = cross1.dot(cross1);
    if (denom < 0.0001) return;

    const w = new v3d.Vector3().copy(rayOrigin).sub(hitPoint);
    const cross2 = new v3d.Vector3().crossVectors(rayDir, cross1);
    const t = w.dot(cross2) / denom;

    const sign = getAxisSign();

    const dt = t - initialAxisOffset;
    const newPos = groupStartPos.clone();

    if (activeAxis === "x") {
      newPos.x = groupStartPos.x + dt * sign;
    } else if (activeAxis === "y") {
      newPos.z = groupStartPos.z + dt * sign;
    } else if (activeAxis === "z") {
      newPos.y = groupStartPos.y + dt * sign;
    }

    // 应用视锥边界约束
    if (viewBounds) {
      newPos.y = Math.max(viewBounds.yMin, Math.min(newPos.y, viewBounds.yMax));
      newPos.x = Math.max(
        -viewBounds.xMax,
        Math.min(newPos.x, viewBounds.xMax),
      );
      newPos.z = Math.max(
        -viewBounds.zMax,
        Math.min(newPos.z, viewBounds.zMax),
      );
    }

    setAllPositions(newPos.x, newPos.y, newPos.z);
  }

  // ---- 指针松开 ----
  function onPointerUpCapture(e) {
    if (!isDragging) return;

    if (capturedPointerId !== null) {
      try {
        domElement.releasePointerCapture(capturedPointerId);
      } catch (_) {}
      capturedPointerId = null;
    }

    isDragging = false;
    activeAxis = null;
    domElement.style.cursor = "default";

    if (app.controls) {
      app.controls.enabled = true;
    }

    const pos = getGroupPosition();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ x: pos.x, y: pos.y, z: pos.z }),
    );
  }

  // ---- 注册事件（使用捕获阶段，确保在控制器之前处理） ----
  domElement.addEventListener("pointerdown", onPointerDownCapture, true);
  domElement.addEventListener("pointermove", onPointerMoveCapture, true);
  domElement.addEventListener("pointerup", onPointerUpCapture, true);
  domElement.addEventListener("pointerleave", function (e) {
    if (!isDragging) return;
    if (capturedPointerId !== null) {
      try {
        domElement.releasePointerCapture(capturedPointerId);
      } catch (_) {}
      capturedPointerId = null;
    }
    isDragging = false;
    activeAxis = null;
    domElement.style.cursor = "default";
    if (app.controls) app.controls.enabled = true;
  });

  // ---- 公开方法 ----
  return {
    getMarker: function () {
      return getGroupPosition();
    },
    resetPosition: function () {
      setAllPositions(0, 0, 0);
      localStorage.removeItem(STORAGE_KEY);
    },
    setAxis: function (axis) {
      buttonAxis = axis;
    },
  };
}
