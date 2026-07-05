/**
 * 生成任天堂风格的卡通头像（canvas → base64，约 2-4KB）。
 * 基于用户名哈希生成稳定的随机种子，同一个用户名始终生成相同的头像。
 */

const COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
  "#F8C471",
  "#82E0AA",
];

const BG_COLORS = [
  "#FFF8E1",
  "#E8F5E9",
  "#E3F2FD",
  "#FCE4EC",
  "#F3E5F5",
  "#E0F2F1",
  "#FFF3E0",
  "#EDE7F6",
];

/** 简单哈希，将字符串转为 0-1 的数字种子 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0x7fffffff;
  }
  return hash / 0x7fffffff;
}

/** 根据种子生成卡通头像 */
export function generateAvatar(seed: string): string {
  const s = hashString(seed);
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  // 背景
  const bg =
    BG_COLORS[Math.floor(s * 10 * BG_COLORS.length) % BG_COLORS.length];
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(64, 64, 64, 0, Math.PI * 2);
  ctx.fill();

  const hairColor = COLORS[Math.floor(s * 3 * COLORS.length) % COLORS.length];

  // 头发（顶部弧线）
  ctx.fillStyle = hairColor;
  ctx.beginPath();
  ctx.arc(64, 48, 40, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(30, 40, 68, 24);

  // 脸
  ctx.fillStyle = "#FDDCB5";
  ctx.beginPath();
  ctx.arc(64, 68, 30, Math.PI * 0.1, Math.PI * 0.9);
  ctx.fill();

  // 眼睛
  const eyeSize = 5 + ((s * 3) % 3);
  ctx.fillStyle = "#333";
  // 左眼
  ctx.beginPath();
  ctx.arc(56 - ((s * 10) % 4), 62, eyeSize, 0, Math.PI * 2);
  ctx.fill();
  // 右眼
  ctx.beginPath();
  ctx.arc(72 + ((s * 20) % 4), 62, eyeSize, 0, Math.PI * 2);
  ctx.fill();

  // 嘴
  ctx.strokeStyle = "#E57373";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(64, 73 + ((s * 5) % 4), 8, 0.1, Math.PI - 0.1);
  ctx.stroke();

  // 腮红
  ctx.fillStyle = "rgba(255,150,150,0.3)";
  ctx.beginPath();
  ctx.ellipse(44, 74, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(84, 74, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toDataURL("image/jpeg", 0.6);
}
