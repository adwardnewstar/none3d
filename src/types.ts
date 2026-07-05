/** App 展示项 */
export interface AppItem {
  _id: string;
  title: string;
  description: string;
  /** 缩略图在 COS 上的路径 */
  thumbnail: string;
  /** Verge3D 入口 HTML 在 COS 上的完整路径 */
  indexPath: string;
  /** Verge3D 项目文件夹路径（用于上传时定位） */
  folderPath: string;
  /** 排序权重，越小越靠前 */
  sortOrder: number;
  /** 是否已发布 */
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 后台登录信息 */
export interface AdminConfig {
  username: string;
  passwordHash: string;
}

/** 3D 场景坐标 */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/** 游客评论 */
export interface CommentItem {
  _id: string;
  /** 关联的 AppItem._id */
  appId: string;
  /** 父评论 ID（null = 顶级评论，非 null = 回复） */
  parentId: string | null;
  /** 发布用户 UID (Supabase Auth) */
  userId?: string;
  /** 用户昵称 */
  nickname: string;
  /** 评论内容 */
  content: string;
  /** 是否已在 3D 场景中标定（有 annotation，仅顶级评论有效） */
  isCalibrated: boolean;
  /** 3D 场景坐标（标定后才存，仅顶级评论有效） */
  position: Position3D | null;
  /** 点赞数 */
  likes: number;
  /** 点赞用户 ID 列表（用于去重/取消） */
  likedBy: string[];
  /** 踩数 */
  dislikes: number;
  /** 踩用户 ID 列表 */
  dislikedBy: string[];
  /** 回复附带的图片（base64 缩略图，<20KB，最多 2 张） */
  images?: string[];
  /** 创建时间 ISO 字符串 */
  createdAt: string;
  /** 更新时间 ISO 字符串 */
  updatedAt: string;
}

/** 用户档案（存于 UserProfile 集合） */
export interface UserProfile {
  _id?: string;
  /** 关联 Supabase Auth 的 UID */
  uid: string;
  /** 用户昵称 */
  nickname: string;
  /** 头像（base64 data URL） */
  avatar: string;
  /** 电话 */
  phone?: string;
  /** 邮箱 */
  email?: string;
  /** 公司 */
  company?: string;
  createdAt?: string;
  updatedAt?: string;
}
