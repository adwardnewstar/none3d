/** 将图片文件压缩为 base64 缩略图（目标 <20KB），返回 data URL */
export function compressImage(file: File, maxBytes = 20 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // 先用最大 240px 宽缩放
        let w = img.width;
        let h = img.height;
        const MAX_W = 240;
        if (w > MAX_W) {
          h = Math.round(h * (MAX_W / w));
          w = MAX_W;
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);

        // 二分法尝试质量，找到 <maxBytes 的最高质量
        let quality = 0.7;
        let result = canvas.toDataURL("image/jpeg", quality);
        if (result.length > maxBytes) {
          // 质量二分尝试
          let lo = 0.1, hi = 0.7;
          for (let i = 0; i < 8; i++) {
            quality = (lo + hi) / 2;
            result = canvas.toDataURL("image/jpeg", quality);
            if (result.length > maxBytes) {
              hi = quality;
            } else {
              lo = quality;
            }
          }
        }

        resolve(result);
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
