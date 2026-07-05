import type { CommentItem } from "@/types";
import { supabase } from "@/supabase";

/** 数据库到 TypeScript 的列映射 */
function mapComment(row: any): CommentItem {
  return {
    _id: row.id,
    appId: row.app_id,
    parentId: row.parent_id,
    userId: row.user_id || undefined,
    nickname: row.nickname,
    content: row.content,
    isCalibrated: row.is_calibrated,
    position:
      row.position_x != null
        ? { x: row.position_x, y: row.position_y, z: row.position_z }
        : null,
    likes: row.likes,
    likedBy: row.liked_by || [],
    dislikes: row.dislikes,
    dislikedBy: row.disliked_by || [],
    images: row.images || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 查询指定 App 的评论（按时间倒序） */
export async function queryComments(appId: string): Promise<CommentItem[]> {
  try {
    const { data, error } = await supabase
      .from("n3d_comments")
      .select("*")
      .eq("app_id", appId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapComment);
  } catch (e) {
    console.error("查询评论失败:", e);
    return [];
  }
}

/** 添加评论，返回创建的评论 ID（或 null 表示失败） */
export async function addComment(
  appId: string,
  nickname: string,
  content: string,
  parentId?: string | null,
  images?: string[],
  isCalibrated?: boolean,
  position?: { x: number; y: number; z: number } | null,
): Promise<string | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id || null;
    const { data, error } = await supabase
      .from("n3d_comments")
      .insert({
        app_id: appId,
        parent_id: parentId || null,
        user_id: userId,
        nickname: nickname.trim() || "匿名用户",
        content: content.trim(),
        is_calibrated: isCalibrated || false,
        position_x: position?.x ?? null,
        position_y: position?.y ?? null,
        position_z: position?.z ?? null,
        likes: 0,
        liked_by: [],
        dislikes: 0,
        disliked_by: [],
        images: images && images.length > 0 ? images : [],
      })
      .select("id");

    if (error) throw error;
    return data?.[0]?.id || null;
  } catch (e) {
    console.error("添加评论失败:", e);
    return null;
  }
}

/** 更新评论内容 */
export async function updateComment(
  commentId: string,
  content: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("n3d_comments")
      .update({ content: content.trim(), updated_at: new Date().toISOString() })
      .eq("id", commentId);

    if (error) throw error;
    return true;
  } catch (e) {
    console.error("更新评论失败:", e);
    return false;
  }
}

/** 删除评论 */
export async function deleteComment(commentId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("n3d_comments")
      .delete()
      .eq("id", commentId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("删除评论失败:", e);
    return false;
  }
}

/** 标定评论（记录 3D 坐标） */
export async function calibrateComment(
  commentId: string,
  position: { x: number; y: number; z: number } | null,
): Promise<boolean> {
  try {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (position) {
      updateData.is_calibrated = true;
      updateData.position_x = position.x;
      updateData.position_y = position.y;
      updateData.position_z = position.z;
    } else {
      updateData.is_calibrated = false;
      updateData.position_x = null;
      updateData.position_y = null;
      updateData.position_z = null;
    }

    const { error } = await supabase
      .from("n3d_comments")
      .update(updateData)
      .eq("id", commentId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("标定评论失败:", e);
    return false;
  }
}

/** 切换点赞状态 */
export async function toggleLike(
  commentId: string,
  userId: string,
  currentlyLiked: boolean,
): Promise<boolean> {
  try {
    // 先获取当前数据
    const { data, error: fetchError } = await supabase
      .from("n3d_comments")
      .select("liked_by, likes")
      .eq("id", commentId)
      .single();

    if (fetchError) throw fetchError;

    const likedBy: string[] = data?.liked_by || [];
    const likes = data?.likes || 0;

    if (currentlyLiked) {
      // 取消点赞
      const { error } = await supabase
        .from("n3d_comments")
        .update({
          liked_by: likedBy.filter((id: string) => id !== userId),
          likes: Math.max(0, likes - 1),
          updated_at: new Date().toISOString(),
        })
        .eq("id", commentId);
      if (error) throw error;
    } else {
      // 点赞
      const { error } = await supabase
        .from("n3d_comments")
        .update({
          liked_by: [...likedBy, userId],
          likes: likes + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", commentId);
      if (error) throw error;
    }
    return true;
  } catch (e) {
    console.error("切换点赞失败:", e);
    return false;
  }
}

/** 切换踩状态 */
export async function toggleDislike(
  commentId: string,
  userId: string,
  currentlyDisliked: boolean,
): Promise<boolean> {
  try {
    const { data, error: fetchError } = await supabase
      .from("n3d_comments")
      .select("disliked_by, dislikes")
      .eq("id", commentId)
      .single();

    if (fetchError) throw fetchError;

    const dislikedBy: string[] = data?.disliked_by || [];
    const dislikes = data?.dislikes || 0;

    if (currentlyDisliked) {
      const { error } = await supabase
        .from("n3d_comments")
        .update({
          disliked_by: dislikedBy.filter((id: string) => id !== userId),
          dislikes: Math.max(0, dislikes - 1),
          updated_at: new Date().toISOString(),
        })
        .eq("id", commentId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("n3d_comments")
        .update({
          disliked_by: [...dislikedBy, userId],
          dislikes: dislikes + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", commentId);
      if (error) throw error;
    }
    return true;
  } catch (e) {
    console.error("切换踩失败:", e);
    return false;
  }
}
