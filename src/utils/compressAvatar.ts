import { compressBase64 } from "./compress";

/** 将图片压缩为头像 base64 data URL，目标 ≤ 5KB */
export function compressAvatar(file: File): Promise<string> {
  return compressBase64(file, {
    maxWidth: 48,
    minSize: 32,
    maxBytes: 5120,
    initialQuality: 0.5,
    iterations: 10,
  });
}
