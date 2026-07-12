import {
  ArrowDown,
  ArrowUp,
  Maximize,
  Minimize,
  Search,
  SortAsc,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import AppCard from "@/components/AppCard";
import AppViewer from "@/components/AppViewer";
import HomeHeader from "@/components/HomeHeader";
import UploadDialog from "@/components/UploadDialog";
import ProcessTool from "@/components/ProcessTool";
import { useAppStore } from "@/store";
import { supabase } from "@/supabase";
import { deleteAppRecord } from "@/filebase";
import type { AppItem } from "@/types";

type SortMode = "name" | "updated-asc" | "updated-desc";

const SORT_LABELS: Record<SortMode, string> = {
  name: "名称排序",
  "updated-asc": "时间↑",
  "updated-desc": "时间↓",
};

const SORT_CYCLE: SortMode[] = ["name", "updated-asc", "updated-desc"];

export default function Home() {
  const { apps, loading, setApps, removeApp } = useAppStore();
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [processToolOpen, setProcessToolOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

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

  const [isFullscreen, setIsFullscreen] = useState(
    () => !!document.fullscreenElement,
  );

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
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

  // 排序 + 搜索
  const displayApps = useMemo(() => {
    let list = [...apps];
    // 排序
    switch (sortMode) {
      case "name":
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "updated-asc":
        list.sort(
          (a, b) =>
            new Date(a.updatedAt || 0).getTime() -
            new Date(b.updatedAt || 0).getTime(),
        );
        break;
      case "updated-desc":
        list.sort(
          (a, b) =>
            new Date(b.updatedAt || 0).getTime() -
            new Date(a.updatedAt || 0).getTime(),
        );
        break;
    }
    // 搜索
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((app) => app.title.toLowerCase().includes(q));
    }
    return list;
  }, [apps, sortMode, searchQuery]);

  const cycleSort = () => {
    setSortMode((prev) => {
      const idx = SORT_CYCLE.indexOf(prev);
      return SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
    });
  };

  const toggleSearch = () => {
    setSearchOpen((v) => {
      if (!v) {
        setTimeout(() => searchRef.current?.focus(), 50);
      } else {
        setSearchQuery("");
      }
      return !v;
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)]">
      {/* 头部 */}
      <header className="relative border-b border-[var(--border-subtle)] px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-wider text-[var(--text-primary)]">
              None3D
            </h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              点击卡片后评论3D模型
            </p>
          </div>
          <HomeHeader
            onUploadOpen={() => setUploadOpen(true)}
            onProcessOpen={() => setProcessToolOpen(true)}
          />
        </div>
      </header>

      {/* App 网格 */}
      <main className="flex-1 px-6 py-10">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[var(--text-secondary)]">
            <div className="h-[120px] w-[120px] animate-spin rounded-full border-[4px] border-[var(--spinner-bg)] border-t-[var(--spinner-fg)]" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-[var(--bg-btn)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-btn-hover)]"
            >
              重新加载
            </button>
          </div>
        ) : displayApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
            <p>暂无展示内容</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
            {displayApps.map((app) => (
              <AppCard key={app._id} app={app} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      {/* 底部 */}
      <footer className="flex items-center justify-between border-t border-[var(--border-subtle)] px-6 py-4 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          {/* 排序按钮 */}
          <button
            onClick={cycleSort}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--border-btn)] bg-[var(--bg-input)] text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-btn-hover)] hover:text-[var(--text-hover)]"
            title={SORT_LABELS[sortMode]}
          >
            <span>
              {sortMode === "name" ? (
                <SortAsc size={14} />
              ) : sortMode === "updated-asc" ? (
                <ArrowUp size={14} />
              ) : (
                <ArrowDown size={14} />
              )}
            </span>
          </button>

          {/* 搜索 */}
          {searchOpen ? (
            <div className="flex items-center gap-1 rounded-full border-2 border-[var(--border-btn)] bg-[var(--bg-input)] px-3 py-1 transition-colors focus-within:border-[var(--border-btn-hover)]">
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => {
                  if (!searchQuery) setSearchOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }
                }}
                placeholder="查找卡片…"
                className="w-24 bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
              <button
                onClick={toggleSearch}
                className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-hover)]"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={toggleSearch}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--border-btn)] bg-[var(--bg-input)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-btn-hover)] hover:text-[var(--text-hover)]"
              title="查找卡片"
            >
              <Search size={14} />
            </button>
          )}

          {/* 全屏按钮 — 仅手机端显示 */}
          <button
            onClick={toggleFullscreen}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--border-btn)] bg-[var(--bg-input)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-btn-hover)] hover:text-[var(--text-hover)]"
            title={isFullscreen ? "退出全屏" : "全屏"}
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </div>

        <div className="max-md:hidden text-center">
          链接{" "}
          <a
            href="https://yun.eightest.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-btn)] hover:underline"
          >
            为之云
          </a>
        </div>
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
