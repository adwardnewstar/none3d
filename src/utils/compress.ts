/** 共享压缩核心：加载图片 → 缩放 → 二分法 JPEG 质量压缩 */
export function compressBase64(
  file: File,
  options: {
    /** 最大宽度（保持比例） */
    maxWidth?: number;
    /** 最小宽高 */
    minSize?: number;
    /** 目标字节数上限 */
    maxBytes?: number;
    /** 初始质量（0~1） */
    initialQuality?: number;
    /** 二分迭代次数 */
    iterations?: number;
  } = {},
): Promise<string> {
  const {
    maxWidth = 240,
    minSize = 0,
    maxBytes = 20 * 1024,
    initialQuality = 0.7,
    iterations = 10,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round(h * (maxWidth / w));
          w = maxWidth;
        }
        if (h > maxWidth) {
          w = Math.round(w * (maxWidth / h));
          h = maxWidth;
        }
        if (w < minSize) w = minSize;
        if (h < minSize) h = minSize;

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);

        let quality = initialQuality;
        let result = canvas.toDataURL("image/jpeg", quality);

        if (result.length > maxBytes) {
          let lo = 0.05,
            hi = initialQuality;
          for (let i = 0; i < iterations; i++) {
            quality = (lo + hi) / 2;
            result = canvas.toDataURL("image/jpeg", quality);
            if (result.length > maxBytes) {
              hi = quality;
            } else {
              lo = quality;
            }
          }
        } else if (initialQuality < 0.92) {
          let lo = initialQuality,
            hi = 0.92;
          for (let i = 0; i < iterations; i++) {
            quality = (lo + hi) / 2;
            const test = canvas.toDataURL("image/jpeg", quality);
            if (test.length > maxBytes) {
              hi = quality;
            } else {
              result = test;
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
