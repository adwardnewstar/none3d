import { compressBase64 } from "./compress";

/** 将图片文件压缩为 base64 缩略图（目标 <20KB），返回 data URL */
export function compressImage(file: File, maxBytes = 20 * 1024): Promise<string> {
  return compressBase64(file, {
    maxWidth: 240,
    maxBytes,
    initialQuality: 0.7,
    iterations: 8,
  });
}
