import { useEffect, useState } from "react";
import AppCard from "@/components/AppCard";
import AppViewer from "@/components/AppViewer";
import HomeHeader from "@/components/HomeHeader";
import UploadDialog from "@/components/UploadDialog";
import ProcessTool from "@/components/ProcessTool";
import { useAppStore, useUserStore } from "@/store";
import { supabase } from "@/supabase";
import { deleteAppRecord } from "@/filebase";
import type { AppItem } from "@/types";

export default function Home() {
  const { apps, loading, setApps, removeApp } = useAppStore();
  const user = useUserStore((s) => s.user);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [processToolOpen, setProcessToolOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadApps = () => {
    supabase
      .from("n3d_app_items")
      .select(
        "id, title, description, thumbnail, index_path, folder_path, sort_order, created_at, updated_at",
      )
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error: err }) => {
        if (err) {
          console.error("查询 App 列表失败:", err);
          setError("数据加载失败");
          return;
        }
        setApps(
          (data || []).map((item) => ({
            _id: item.id,
            title: item.title,
            description: item.description || "",
            thumbnail: item.thumbnail || "",
            indexPath: item.index_path,
            folderPath: item.folder_path || "",
            sortOrder: item.sort_order || 0,
            isPublished: true,
            createdAt: item.created_at || "",
            updatedAt: item.updated_at || "",
          })),
        );
      });
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleDelete = async (app: AppItem) => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteAppRecord(app._id);
      removeApp(app._id);
    } catch (e: any) {
      console.error("[Home] 删除失败:", e);
      alert(`删除失败: ${e.message}`);
    }
    setDeleting(false);
  };

  const handleUploadDone = () => {
    setUploadOpen(false);
    loadApps();
  };

  return (
    <div className="min-h-screen bg-[#0a0e27]">
      {/* 头部 */}
      <header className="relative border-b border-white/5 px-6 py-12">
        <div className="absolute inset-0 bg-gradient-to-b from-[#00d4ff]/5 to-transparent" />
        <div className="relative mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-wider text-white">
              3D 展示中心
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              点击 App 即可全屏浏览 3D 交互场景
            </p>
          </div>
          <HomeHeader />
        </div>
      </header>

      {/* App 网格 */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00d4ff] border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-[#00d4ff]/10 px-4 py-2 text-sm text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20"
            >
              重新加载
            </button>
          </div>
        ) : apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p>暂无展示内容</p>
            {user?.isAdmin && (
              <div className="mt-6 flex gap-4">
                <button
                  onClick={() => setUploadOpen(true)}
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[#00d4ff]/20 bg-[#1a1f3a]/50 px-8 py-6 transition-all duration-300 hover:border-[#00d4ff]/60 hover:bg-[#1a1f3a] hover:shadow-[0_0_20px_rgba(0,212,255,0.15)]"
                >
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#00d4ff"
                    strokeWidth="2"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span className="text-sm text-[#00d4ff]/70">
                    新增 3D 展示
                  </span>
                </button>
                <button
                  onClick={() => setProcessToolOpen(true)}
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[#00d4ff]/20 bg-[#1a1f3a]/50 px-8 py-6 transition-all duration-300 hover:border-[#00d4ff]/60 hover:bg-[#1a1f3a] hover:shadow-[0_0_20px_rgba(0,212,255,0.15)]"
                >
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#00d4ff"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  <span className="text-sm text-[#00d4ff]/70">
                    处理 Verge3D
                  </span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {apps.map((app) => (
              <AppCard key={app._id} app={app} onDelete={handleDelete} />
            ))}
            {user?.isAdmin && (
              <>
                <button
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#00d4ff]/20 bg-[#1a1f3a]/50 p-6 transition-all duration-300 hover:border-[#00d4ff]/60 hover:bg-[#1a1f3a] hover:shadow-[0_0_20px_rgba(0,212,255,0.15)]"
                  onClick={() => setUploadOpen(true)}
                >
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#00d4ff"
                    strokeWidth="2"
                    className="mb-2"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span className="text-sm text-[#00d4ff]/70">
                    新增 3D 展示
                  </span>
                </button>
                <button
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#00d4ff]/20 bg-[#1a1f3a]/50 p-6 transition-all duration-300 hover:border-[#00d4ff]/60 hover:bg-[#1a1f3a] hover:shadow-[0_0_20px_rgba(0,212,255,0.15)]"
                  onClick={() => setProcessToolOpen(true)}
                >
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#00d4ff"
                    strokeWidth="2"
                    className="mb-2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  <span className="text-sm text-[#00d4ff]/70">
                    处理 Verge3D
                  </span>
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {/* 底部 */}
      <footer className="border-t border-white/5 px-6 py-4 text-center text-xs text-gray-500">
        基于 Supabase 构建
      </footer>

      {/* 全屏查看器 */}
      <AppViewer />

      {/* 新增弹窗 */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onDone={handleUploadDone}
      />

      {/* 处理 Verge3D 工具 */}
      <ProcessTool
        open={processToolOpen}
        onClose={() => setProcessToolOpen(false)}
      />
    </div>
  );
}
