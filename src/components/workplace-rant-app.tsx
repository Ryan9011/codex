"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  Bell,
  Bookmark,
  Briefcase,
  ChevronRight,
  Coffee,
  Crown,
  Flame,
  Gauge,
  Hash,
  Heart,
  LogOut,
  Megaphone,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Tag,
  ThumbsUp,
  Trash2,
  Trophy,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import type { FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Database } from "@/lib/database.types";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { generateAnonymousName } from "@/utils/anonymousName";

type CategoryId =
  | "meeting"
  | "kpi"
  | "requirement"
  | "commute"
  | "boss"
  | "slacking"
  | "overtime";

type Category = {
  id: CategoryId;
  label: string;
  tone: string;
};

type Post = Database["public"]["Views"]["post_feed"]["Row"];
type CommentItem = Database["public"]["Views"]["comment_feed"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type PostDraft = {
  title: string;
  content: string;
  category: CategoryId;
  tags: string;
  moodScore: number;
  anonymousMode: boolean;
};

type CommentDraft = {
  content: string;
  anonymousMode: boolean;
};

type AuthDraft = {
  mode: "sign-in" | "sign-up";
  email: string;
  password: string;
  username: string;
};

type ReportTarget =
  | { type: "post"; id: string; label: string }
  | { type: "comment"; id: string; label: string };

type ReportDraft = {
  reason: string;
  details: string;
};

const categories: Category[] = [
  { id: "meeting", label: "会议风暴", tone: "from-cyan-300 to-sky-500" },
  { id: "kpi", label: "KPI玄学", tone: "from-violet-300 to-fuchsia-500" },
  { id: "requirement", label: "需求变更", tone: "from-fuchsia-300 to-rose-500" },
  { id: "commute", label: "通勤补血", tone: "from-emerald-300 to-cyan-500" },
  { id: "boss", label: "老板文学", tone: "from-amber-300 to-pink-500" },
  { id: "slacking", label: "摸鱼情报", tone: "from-sky-300 to-violet-500" },
  { id: "overtime", label: "加班赛道", tone: "from-red-300 to-violet-500" },
];

const categoryIconMap = {
  meeting: Coffee,
  kpi: Gauge,
  requirement: Zap,
  commute: Briefcase,
  boss: Megaphone,
  slacking: Sparkles,
  overtime: Flame,
} satisfies Record<CategoryId, LucideIcon>;

const emptyPostDraft: PostDraft = {
  title: "",
  content: "",
  category: "requirement",
  tags: "",
  moodScore: 3,
  anonymousMode: true,
};

const emptyCommentDraft: CommentDraft = {
  content: "",
  anonymousMode: true,
};

const emptyReportDraft: ReportDraft = {
  reason: "垃圾信息/广告",
  details: "",
};

const reportReasons = [
  "垃圾信息/广告",
  "人身攻击",
  "泄露隐私",
  "职场造谣",
  "违法违规内容",
  "其他",
];

const moodLevels = [
  {
    score: 1,
    label: "还能忍",
    tone: "from-emerald-300 to-cyan-300",
    text: "text-emerald-100",
  },
  {
    score: 2,
    label: "有点烦",
    tone: "from-cyan-300 to-sky-400",
    text: "text-cyan-100",
  },
  {
    score: 3,
    label: "想摸鱼",
    tone: "from-violet-300 to-fuchsia-400",
    text: "text-violet-100",
  },
  {
    score: 4,
    label: "快破防",
    tone: "from-fuchsia-300 to-rose-400",
    text: "text-fuchsia-100",
  },
  {
    score: 5,
    label: "直接离职",
    tone: "from-red-300 to-amber-300",
    text: "text-red-100",
  },
];

export function WorkplaceRantApp() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryId | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [postDraft, setPostDraft] = useState<PostDraft>(emptyPostDraft);
  const [commentDraft, setCommentDraft] =
    useState<CommentDraft>(emptyCommentDraft);
  const [reportDraft, setReportDraft] = useState<ReportDraft>(emptyReportDraft);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reactedPostIds, setReactedPostIds] = useState<Set<string>>(new Set());
  const [archivedPostIds, setArchivedPostIds] = useState<Set<string>>(new Set());
  const [authDraft, setAuthDraft] = useState<AuthDraft>({
    mode: "sign-in",
    email: "",
    password: "",
    username: "",
  });
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [isLoadingPosts, setLoadingPosts] = useState(false);
  const [isLoadingComments, setLoadingComments] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const user = session?.user ?? null;

  const filteredPosts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesCategory =
        activeCategory === "all" || post.category === activeCategory;
      const searchableText = [
        post.display_name,
        post.author_username ?? "",
        post.title,
        post.content,
        getCategoryLabel(post.category),
        ...(post.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return matchesCategory && searchableText.includes(normalizedSearch);
    });
  }, [activeCategory, posts, searchTerm]);

  const trendingPosts = useMemo(
    () =>
      [...posts]
        .sort(
          (a, b) =>
            b.meltdown +
            getMoodScore(b) * 18 +
            b.reaction_count * 0.38 +
            b.comment_count * 0.72 -
            (a.meltdown +
              getMoodScore(a) * 18 +
              a.reaction_count * 0.38 +
              a.comment_count * 0.72),
        )
        .slice(0, 5),
    [posts],
  );

  const totalSame = posts.reduce((sum, post) => sum + post.reaction_count, 0);
  const avgMoodScore = posts.length
    ? Math.round(posts.reduce((sum, post) => sum + getMoodScore(post), 0) / posts.length)
    : 0;

  useEffect(() => {
    if (!supabase) {
      setErrorMessage("Supabase 尚未配置，请先填写 .env.local。");
      return;
    }

    let ignore = false;

    supabase.auth.getSession().then(({ data, error }) => {
      if (ignore) {
        return;
      }

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSession(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      ignore = true;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    void loadPosts();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) {
      setProfile(null);
      setReactedPostIds(new Set());
      return;
    }

    void loadProfile(user.id);
    void loadUserReactions(user.id);
  }, [supabase, user?.id]);

  async function loadPosts() {
    if (!supabase) {
      return;
    }

    setLoadingPosts(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("post_feed")
      .select("*")
      .order("created_at", { ascending: false });

    setLoadingPosts(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setPosts(data ?? []);
  }

  async function loadProfile(userId: string) {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setProfile(data);
  }

  async function loadUserReactions(userId: string) {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from("reactions")
      .select("post_id")
      .eq("user_id", userId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setReactedPostIds(new Set((data ?? []).map((reaction) => reaction.post_id)));
  }

  async function loadComments(post: Post) {
    if (!supabase) {
      return;
    }

    setSelectedPost(post);
    setLoadingComments(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("comment_feed")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });

    setLoadingComments(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setComments(data ?? []);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setErrorMessage("Supabase 尚未配置。");
      return;
    }

    setErrorMessage("");
    setStatusMessage("");

    if (authDraft.mode === "sign-up") {
      if (!authDraft.username.trim()) {
        setErrorMessage("注册时请填写一个用户名。");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: authDraft.email.trim(),
        password: authDraft.password,
        options: {
          data: {
            username: authDraft.username.trim(),
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setStatusMessage(
        data.session
          ? "注册成功，欢迎入座赛博工位。"
          : "注册成功，请先按 Supabase 邮件设置完成邮箱确认。",
      );
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: authDraft.email.trim(),
      password: authDraft.password,
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setStatusMessage("登录成功，工位已同步。");
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setStatusMessage("已退出登录。");
  }

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user) {
      setErrorMessage("请先登录后再开始吐槽。");
      return;
    }

    if (!postDraft.title.trim() || !postDraft.content.trim()) {
      setErrorMessage("标题和内容都要写一点，工位信号才能发出去。");
      return;
    }

    const tags = postDraft.tags
      .split(/[,，\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 5);

    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      title: postDraft.title.trim(),
      content: postDraft.content.trim(),
      category: postDraft.category,
      tags,
      mood_score: postDraft.moodScore,
      meltdown: postDraft.moodScore * 20,
      anonymous_mode: postDraft.anonymousMode,
      anonymous_name: postDraft.anonymousMode ? generateAnonymousName() : "",
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setPostDraft(emptyPostDraft);
    setComposerOpen(false);
    setStatusMessage("吐槽已发布，正在同步到帖子流。");
    await loadPosts();
    await loadUserReactions(user.id);
  }

  async function handleDeletePost(postId: string) {
    if (!supabase || !user) {
      setErrorMessage("请先登录。");
      return;
    }

    const confirmed = window.confirm("确认删除这条吐槽吗？支招和共鸣也会一起删除。");
    if (!confirmed) {
      return;
    }

    const { error } = await supabase.from("posts").delete().eq("id", postId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setStatusMessage("吐槽已删除。");
    await loadPosts();
  }

  async function handleSame(post: Post) {
    if (!supabase || !user) {
      setErrorMessage("登录后才能点“俺也一样”。");
      return;
    }

    const alreadyReacted = reactedPostIds.has(post.id);

    if (alreadyReacted) {
      const { error } = await supabase
        .from("reactions")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", user.id);

      if (error) {
        setErrorMessage(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("reactions").insert({
        post_id: post.id,
        user_id: user.id,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }
    }

    await Promise.all([loadPosts(), loadUserReactions(user.id)]);
  }

  function handleArchive(postId: string) {
    setArchivedPostIds((current) => {
      const next = new Set(current);

      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }

      return next;
    });
  }

  async function handleCreateComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user || !selectedPost) {
      setErrorMessage("请先登录并选择一条吐槽。");
      return;
    }

    if (!commentDraft.content.trim()) {
      setErrorMessage("支招内容不能为空。");
      return;
    }

    const { error } = await supabase.from("comments").insert({
      post_id: selectedPost.id,
      user_id: user.id,
      content: commentDraft.content.trim(),
      anonymous_mode: commentDraft.anonymousMode,
      anonymous_name: commentDraft.anonymousMode ? generateAnonymousName() : "",
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setCommentDraft(emptyCommentDraft);
    await Promise.all([loadComments(selectedPost), loadPosts()]);
  }

  async function handleDeleteComment(commentId: string) {
    if (!supabase || !selectedPost) {
      return;
    }

    const { error } = await supabase.from("comments").delete().eq("id", commentId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await Promise.all([loadComments(selectedPost), loadPosts()]);
  }

  async function handleReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user || !reportTarget) {
      setErrorMessage("请先登录后再上报 HR 审查。");
      return;
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      post_id: reportTarget.type === "post" ? reportTarget.id : null,
      comment_id: reportTarget.type === "comment" ? reportTarget.id : null,
      reason: reportDraft.reason,
      details: reportDraft.details.trim() || null,
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setReportTarget(null);
    setReportDraft(emptyReportDraft);
    setStatusMessage("已上报 HR 审查，管理员可以在 reports 表中处理。");
  }

  return (
    <main className="min-h-screen pb-10">
      <TopNav
        profile={profile}
        searchTerm={searchTerm}
        user={user}
        onOpenComposer={() => setComposerOpen(true)}
        onSearchChange={setSearchTerm}
      />

      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-5 px-4 py-5 lg:grid-cols-[250px_minmax(0,1fr)_320px] xl:px-6">
        <LeftSidebar
          activeCategory={activeCategory}
          posts={posts}
          onCategoryChange={setActiveCategory}
        />

        <section className="min-w-0 space-y-5">
          <HeroCard
            avgMoodScore={avgMoodScore}
            isConfigured={isSupabaseConfigured}
            isLoading={isLoadingPosts}
            totalSame={totalSame}
            user={user}
            onOpenComposer={() => setComposerOpen(true)}
            onRefresh={() => void loadPosts()}
          />

          <MobileCategoryStrip
            activeCategory={activeCategory}
            posts={posts}
            onCategoryChange={setActiveCategory}
          />

          <StatusStrip errorMessage={errorMessage} statusMessage={statusMessage} />

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-200/70">
                Live Feed
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-white md:text-3xl">
                今日工位精神状态
              </h1>
            </div>
            <div className="hidden items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100 sm:flex">
              <Flame className="h-4 w-4 text-fuchsia-300" />
              {filteredPosts.length} 条正在冒烟
            </div>
          </div>

          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <PostCard
                isArchived={archivedPostIds.has(post.id)}
                isOwner={user?.id === post.user_id}
                isReacted={reactedPostIds.has(post.id)}
                key={post.id}
                post={post}
                onArchive={() => handleArchive(post.id)}
                onComments={() => void loadComments(post)}
                onDelete={() => void handleDeletePost(post.id)}
                onReport={() =>
                  setReportTarget({
                    type: "post",
                    id: post.id,
                    label: post.title,
                  })
                }
                onSame={() => void handleSame(post)}
              />
            ))}

            {!isLoadingPosts && filteredPosts.length === 0 ? (
              <div className="glass-panel rounded-lg p-10 text-center">
                <p className="text-lg font-semibold text-white">暂无真实吐槽数据</p>
                <p className="mt-2 text-sm text-slate-300">
                  配好 Supabase 后，登录并发布第一条赛博工位信号。
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <RightSidebar
          authDraft={authDraft}
          profile={profile}
          trendingPosts={trendingPosts}
          user={user}
          onAuthDraftChange={setAuthDraft}
          onAuthSubmit={handleAuthSubmit}
          onSignOut={() => void handleSignOut()}
        />
      </div>

      <PublishModal
        draft={postDraft}
        isOpen={isComposerOpen}
        profile={profile}
        user={user}
        onClose={() => setComposerOpen(false)}
        onDraftChange={setPostDraft}
        onSubmit={handleCreatePost}
      />

      <CommentsModal
        comments={comments}
        draft={commentDraft}
        isLoading={isLoadingComments}
        post={selectedPost}
        profile={profile}
        user={user}
        onClose={() => setSelectedPost(null)}
        onDeleteComment={(commentId) => void handleDeleteComment(commentId)}
        onDraftChange={setCommentDraft}
        onReportComment={(comment) =>
          setReportTarget({
            type: "comment",
            id: comment.id,
            label: comment.content.slice(0, 48),
          })
        }
        onSubmit={handleCreateComment}
      />

      <ReportModal
        draft={reportDraft}
        target={reportTarget}
        user={user}
        onClose={() => setReportTarget(null)}
        onDraftChange={setReportDraft}
        onSubmit={handleReportSubmit}
      />
    </main>
  );
}

function TopNav({
  profile,
  searchTerm,
  user,
  onSearchChange,
  onOpenComposer,
}: {
  profile: Profile | null;
  searchTerm: string;
  user: User | null;
  onSearchChange: (value: string) => void;
  onOpenComposer: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-cyan-300/15 bg-[#05030a]/[0.78] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-3 px-4 xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_24px_rgba(34,211,238,0.22)]">
            <Zap className="h-5 w-5 text-cyan-200" />
          </div>
          <div className="hidden sm:block">
            <p className="neon-text text-base font-bold text-white">
              打工人吐槽日常
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-fuchsia-200/70">
              Supabase Rant Net
            </p>
          </div>
        </div>

        <label className="relative ml-auto hidden w-full max-w-sm md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/70" />
          <input
            className="h-11 w-full rounded-lg border border-cyan-300/20 bg-white/[0.06] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:bg-cyan-300/10"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜：老板文学 / KPI / 早八"
            value={searchTerm}
          />
        </label>

        <button
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-300 via-sky-400 to-fuchsia-400 px-4 text-sm font-semibold text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.3)] transition hover:scale-[1.02] active:scale-[0.98]"
          onClick={onOpenComposer}
          type="button"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">开始吐槽</span>
        </button>

        <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-200 sm:flex">
          <UserRound className="h-4 w-4 text-cyan-200" />
          <span className="max-w-28 truncate">
            {user ? profile?.username ?? user.email : "未登录"}
          </span>
        </div>

        <button
          aria-label="通知"
          className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-100"
          type="button"
        >
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function HeroCard({
  avgMoodScore,
  isConfigured,
  isLoading,
  totalSame,
  user,
  onOpenComposer,
  onRefresh,
}: {
  avgMoodScore: number;
  isConfigured: boolean;
  isLoading: boolean;
  totalSame: number;
  user: User | null;
  onOpenComposer: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="glass-panel neon-card noise-texture rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-200/70">
            Anonymous Broadcast
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
            欢迎来到赛博工位。
          </h2>
          <div className="mt-3 max-w-3xl space-y-3 text-sm leading-7 text-slate-300">
            <p>
              <span className="block">这里没有老板画饼，</span>
              <span className="block">没有已读不回，</span>
              <span className="block">也没有凌晨两点还在闪烁的工作群。</span>
            </p>
            <p>
              <span className="block">这里只有一群还没下班的打工人，</span>
              <span className="block">
                在这里匿名吐槽、围观职场瓜、互相支招，
              </span>
              <span className="block">
                顺便确认一下：原来不是我一个人这么惨。
              </span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <MetricPill icon={ThumbsUp} label="俺也一样" value={formatCount(totalSame)} />
          <MetricPill
            icon={Gauge}
            label="平均破防"
            value={`${avgMoodScore}·${getMoodLevel(avgMoodScore).label}`}
          />
        </div>
      </div>

      {!isConfigured ? (
        <div className="mt-5 rounded-lg border border-amber-300/25 bg-amber-300/[0.08] p-4 text-sm leading-6 text-amber-50">
          请先复制 `.env.local.example` 为 `.env.local`，填入
          `NEXT_PUBLIC_SUPABASE_URL` 和 publishable key，然后执行
          `supabase/schema.sql`。
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <button
          className="flex w-full items-center justify-between rounded-lg border border-cyan-300/25 bg-[#050816]/[0.72] px-4 py-4 text-left transition hover:border-cyan-300/55 hover:bg-cyan-300/10"
          onClick={onOpenComposer}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-fuchsia-300/15 text-fuchsia-100">
              <Send className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">
                {user ? "开始吐槽你的工位剧情" : "登录后开始吐槽"}
              </span>
              <span className="mt-1 block truncate text-xs text-slate-400">
                支持匿名模式，anonymous_name 会替代真实 username
              </span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-cyan-200" />
        </button>

        <button
          className="inline-flex h-full min-h-14 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-100"
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>
    </div>
  );
}

function LeftSidebar({
  activeCategory,
  posts,
  onCategoryChange,
}: {
  activeCategory: CategoryId | "all";
  posts: Post[];
  onCategoryChange: (category: CategoryId | "all") => void;
}) {
  return (
    <aside className="sticky top-[92px] hidden h-[calc(100vh-6.5rem)] space-y-4 overflow-y-auto lg:block">
      <div className="glass-panel neon-card rounded-lg p-4">
        <div className="mb-4 flex items-center gap-2">
          <Hash className="h-4 w-4 text-cyan-200" />
          <h2 className="text-sm font-semibold text-white">吐槽频道</h2>
        </div>

        <div className="space-y-2">
          <CategoryButton
            active={activeCategory === "all"}
            count={posts.length}
            label="全部工位"
            onClick={() => onCategoryChange("all")}
          />
          {categories.map((category) => (
            <CategoryButton
              active={activeCategory === category.id}
              count={posts.filter((post) => post.category === category.id).length}
              icon={categoryIconMap[category.id]}
              key={category.id}
              label={category.label}
              onClick={() => onCategoryChange(category.id)}
              tone={category.tone}
            />
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-fuchsia-200" />
          <h2 className="text-sm font-semibold text-white">Supabase 状态</h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <StatTile label="数据源" value={isSupabaseConfigured ? "LIVE" : "ENV"} />
          <StatTile label="帖子" value={`${posts.length}`} />
          <StatTile label="支招" value={`${sumBy(posts, "comment_count")}`} />
          <StatTile label="共鸣" value={`${sumBy(posts, "reaction_count")}`} />
        </div>
      </div>
    </aside>
  );
}

function CategoryButton({
  active,
  count,
  label,
  onClick,
  tone = "from-cyan-300 to-violet-400",
  icon: Icon = Hash,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
  tone?: string;
  icon?: LucideIcon;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
        active
          ? "border-cyan-300/45 bg-cyan-300/[0.12] text-white shadow-[0_0_20px_rgba(34,211,238,0.12)]"
          : "border-white/[0.08] bg-white/[0.035] text-slate-300 hover:border-fuchsia-300/35 hover:bg-white/[0.07] hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gradient-to-br ${tone} text-slate-950`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
      <span className="font-mono text-xs text-slate-400">{count}</span>
    </button>
  );
}

function MobileCategoryStrip({
  activeCategory,
  posts,
  onCategoryChange,
}: {
  activeCategory: CategoryId | "all";
  posts: Post[];
  onCategoryChange: (category: CategoryId | "all") => void;
}) {
  return (
    <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1 lg:hidden">
      <MobileChip
        active={activeCategory === "all"}
        label={`全部 ${posts.length}`}
        onClick={() => onCategoryChange("all")}
      />
      {categories.map((category) => (
        <MobileChip
          active={activeCategory === category.id}
          key={category.id}
          label={`${category.label} ${
            posts.filter((post) => post.category === category.id).length
          }`}
          onClick={() => onCategoryChange(category.id)}
        />
      ))}
    </div>
  );
}

function MobileChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`shrink-0 rounded-lg border px-3 py-2 text-sm transition ${
        active
          ? "border-cyan-300/55 bg-cyan-300/15 text-cyan-50"
          : "border-white/10 bg-white/[0.04] text-slate-300"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function StatusStrip({
  errorMessage,
  statusMessage,
}: {
  errorMessage: string;
  statusMessage: string;
}) {
  if (!errorMessage && !statusMessage) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm leading-6 ${
        errorMessage
          ? "border-rose-300/30 bg-rose-300/[0.08] text-rose-100"
          : "border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-100"
      }`}
    >
      {errorMessage || statusMessage}
    </div>
  );
}

function PostCard({
  post,
  isArchived,
  isOwner,
  isReacted,
  onArchive,
  onComments,
  onDelete,
  onReport,
  onSame,
}: {
  post: Post;
  isArchived: boolean;
  isOwner: boolean;
  isReacted: boolean;
  onArchive: () => void;
  onComments: () => void;
  onDelete: () => void;
  onReport: () => void;
  onSame: () => void;
}) {
  const category = categories.find((item) => item.id === post.category);
  const Icon = getCategoryIcon(post.category);

  return (
    <article className="glass-panel neon-card rounded-lg p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/35 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
          <span className="font-mono text-sm">匿</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-white">{post.display_name}</p>
            {!post.anonymous_mode ? (
              <span className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.08] px-2 py-1 text-[11px] text-emerald-100">
                真实身份
              </span>
            ) : null}
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-slate-400">
              {formatRelativeTime(post.created_at)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[11px] font-medium text-cyan-100">
              <Icon className="h-3 w-3" />
              {category?.label ?? post.category}
            </span>
          </div>

          <h3 className="mt-3 text-lg font-semibold leading-snug text-white sm:text-xl">
            {post.title}
          </h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">{post.content}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {(post.tags ?? []).map((tag) => (
              <span
                className="inline-flex items-center gap-1 rounded-md border border-fuchsia-300/[0.18] bg-fuchsia-300/[0.08] px-2.5 py-1 text-xs text-fuchsia-100"
                key={tag}
              >
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-white/[0.08] pt-4 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="space-y-3">
          <MoodMeter score={getMoodScore(post)} />
          <div className="grid grid-cols-2 gap-2">
            <SignalStat
              accent="text-fuchsia-200"
              icon={MessageCircle}
              label="支招"
              value={`${post.comment_count}`}
            />
            <SignalStat
              accent="text-amber-200"
              icon={Heart}
              label="共鸣"
              value={formatCount(post.reaction_count)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
              isReacted
                ? "bg-gradient-to-r from-fuchsia-300 to-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(217,70,239,0.28)]"
                : "border border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100 hover:border-cyan-300/55 hover:bg-cyan-300/[0.14]"
            }`}
            onClick={onSame}
            type="button"
          >
            <ThumbsUp className="h-4 w-4" />
            俺也一样
          </button>
          <IconButton label="支招一下" icon={MessageCircle} onClick={onComments} />
          <IconButton
            active={isArchived}
            label="存档摸鱼"
            icon={Bookmark}
            onClick={onArchive}
          />
          <IconButton
            label="上报 HR 审查"
            icon={ShieldAlert}
            onClick={onReport}
          />
          {isOwner ? (
            <IconButton label="删除" icon={Trash2} onClick={onDelete} tone="danger" />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function RightSidebar({
  authDraft,
  profile,
  trendingPosts,
  user,
  onAuthDraftChange,
  onAuthSubmit,
  onSignOut,
}: {
  authDraft: AuthDraft;
  profile: Profile | null;
  trendingPosts: Post[];
  user: User | null;
  onAuthDraftChange: (draft: AuthDraft) => void;
  onAuthSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void;
}) {
  return (
    <aside className="sticky top-[92px] hidden h-[calc(100vh-6.5rem)] space-y-4 overflow-y-auto lg:block">
      <AuthPanel
        authDraft={authDraft}
        profile={profile}
        user={user}
        onAuthDraftChange={onAuthDraftChange}
        onAuthSubmit={onAuthSubmit}
        onSignOut={onSignOut}
      />

      <div className="glass-panel neon-card rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-200" />
            <h2 className="text-sm font-semibold text-white">今日破防榜</h2>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Realtime
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {trendingPosts.map((post, index) => (
            <div
              className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-3 transition hover:border-cyan-300/30 hover:bg-white/[0.06]"
              key={post.id}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-md font-mono text-xs font-bold ${
                    index === 0
                      ? "bg-amber-300 text-slate-950"
                      : "bg-cyan-300/[0.12] text-cyan-100"
                  }`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium leading-5 text-white">
                    {post.title}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <Flame className="h-3 w-3 text-fuchsia-200" />
                    {getMoodScore(post)}·{getMoodLevel(getMoodScore(post)).label} ·{" "}
                    {formatCount(post.reaction_count)} 共鸣
                  </p>
                </div>
              </div>
            </div>
          ))}
          {trendingPosts.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-400">
              还没有热门数据，等第一条吐槽点燃榜单。
            </p>
          ) : null}
        </div>
      </div>

      <div className="glass-panel rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-fuchsia-200" />
          <h2 className="text-sm font-semibold text-white">今日热词</h2>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["战略弹性", "收到文学", "呼吸感", "小调整", "松弛感", "披萨协议"].map(
            (word) => (
              <span
                className="rounded-md border border-violet-300/20 bg-violet-300/[0.08] px-2.5 py-1.5 text-xs text-violet-100"
                key={word}
              >
                #{word}
              </span>
            ),
          )}
        </div>
      </div>
    </aside>
  );
}

function AuthPanel({
  authDraft,
  profile,
  user,
  onAuthDraftChange,
  onAuthSubmit,
  onSignOut,
}: {
  authDraft: AuthDraft;
  profile: Profile | null;
  user: User | null;
  onAuthDraftChange: (draft: AuthDraft) => void;
  onAuthSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void;
}) {
  if (user) {
    return (
      <div className="glass-panel rounded-lg p-4">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-cyan-200" />
          <h2 className="text-sm font-semibold text-white">当前账号</h2>
        </div>
        <div className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] p-3">
          <p className="text-sm font-semibold text-white">
            {profile?.username ?? user.email}
          </p>
          <p className="mt-1 truncate text-xs text-slate-400">{user.email}</p>
        </div>
        <button
          className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] text-sm font-semibold text-slate-200 transition hover:border-fuchsia-300/40 hover:text-white"
          onClick={onSignOut}
          type="button"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-lg p-4">
      <div className="flex items-center gap-2">
        <UserRound className="h-4 w-4 text-cyan-200" />
        <h2 className="text-sm font-semibold text-white">登录 / 注册</h2>
      </div>

      <form className="mt-4 space-y-3" onSubmit={onAuthSubmit}>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-1">
          {[
            ["sign-in", "登录"],
            ["sign-up", "注册"],
          ].map(([mode, label]) => (
            <button
              className={`h-9 rounded-md text-sm font-semibold transition ${
                authDraft.mode === mode
                  ? "bg-cyan-300 text-slate-950"
                  : "text-slate-300 hover:bg-white/[0.06]"
              }`}
              key={mode}
              onClick={() =>
                onAuthDraftChange({ ...authDraft, mode: mode as AuthDraft["mode"] })
              }
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {authDraft.mode === "sign-up" ? (
          <input
            className="h-11 w-full rounded-lg border border-cyan-300/20 bg-white/[0.06] px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
            onChange={(event) =>
              onAuthDraftChange({ ...authDraft, username: event.target.value })
            }
            placeholder="username"
            value={authDraft.username}
          />
        ) : null}

        <input
          className="h-11 w-full rounded-lg border border-cyan-300/20 bg-white/[0.06] px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
          onChange={(event) =>
            onAuthDraftChange({ ...authDraft, email: event.target.value })
          }
          placeholder="email"
          type="email"
          value={authDraft.email}
        />
        <input
          className="h-11 w-full rounded-lg border border-cyan-300/20 bg-white/[0.06] px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
          onChange={(event) =>
            onAuthDraftChange({ ...authDraft, password: event.target.value })
          }
          placeholder="password"
          type="password"
          value={authDraft.password}
        />

        <button
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-gradient-to-r from-cyan-300 to-fuchsia-400 text-sm font-semibold text-slate-950"
          type="submit"
        >
          {authDraft.mode === "sign-up" ? "创建账号" : "登录工位"}
        </button>
      </form>
    </div>
  );
}

function PublishModal({
  draft,
  isOpen,
  profile,
  user,
  onClose,
  onDraftChange,
  onSubmit,
}: {
  draft: PostDraft;
  isOpen: boolean;
  profile: Profile | null;
  user: User | null;
  onClose: () => void;
  onDraftChange: (draft: PostDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/[0.78] px-4 backdrop-blur-md">
      <div className="glass-panel neon-card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg p-5 shadow-2xl">
        <ModalHeader eyebrow="New Signal" title="开始吐槽" onClose={onClose} />

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <FormInput
            label="标题"
            maxLength={80}
            onChange={(value) => onDraftChange({ ...draft, title: value })}
            placeholder="比如：今天的会把我的灵魂开成了 PDF"
            value={draft.title}
          />

          <FormTextarea
            label="内容"
            maxLength={1000}
            onChange={(value) => onDraftChange({ ...draft, content: value })}
            placeholder="把今日工位剧情完整发射出来..."
            value={draft.content}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                className="text-sm font-medium text-slate-200"
                htmlFor="category"
              >
                分类
              </label>
              <select
                className="mt-2 h-12 w-full rounded-lg border border-cyan-300/20 bg-[#111427] px-3 text-white outline-none transition focus:border-cyan-300/60"
                id="category"
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    category: event.target.value as CategoryId,
                  })
                }
                value={draft.category}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <FormInput
              label="标签"
              onChange={(value) => onDraftChange({ ...draft, tags: value })}
              placeholder="周会, 摸鱼, KPI"
              value={draft.tags}
            />
          </div>

          <AnonymousControls
            anonymousMode={draft.anonymousMode}
            realName={profile?.username ?? user?.email ?? "真实 username"}
            onAnonymousModeChange={(value) =>
              onDraftChange({ ...draft, anonymousMode: value })
            }
          />

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between">
              <label
                className="text-sm font-medium text-slate-200"
                htmlFor="mood-score"
              >
                mood_score 破防指数
              </label>
              <span
                className={`font-mono text-lg font-semibold ${
                  getMoodLevel(draft.moodScore).text
                }`}
              >
                {draft.moodScore} · {getMoodLevel(draft.moodScore).label}
              </span>
            </div>
            <input
              className="mt-3 h-2 w-full accent-cyan-300"
              id="mood-score"
              max={5}
              min={1}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  moodScore: Number(event.target.value),
                })
              }
              type="range"
              value={draft.moodScore}
            />
            <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[11px] text-slate-500">
              {moodLevels.map((level) => (
                <span
                  className={
                    draft.moodScore === level.score ? level.text : "text-slate-500"
                  }
                  key={level.score}
                >
                  {level.label}
                </span>
              ))}
            </div>
          </div>

          <ModalActions
            cancelLabel="先忍一下"
            submitLabel="发射吐槽"
            submitDisabled={!user}
            onCancel={onClose}
          />
        </form>
      </div>
    </div>
  );
}

function CommentsModal({
  comments,
  draft,
  isLoading,
  post,
  profile,
  user,
  onClose,
  onDeleteComment,
  onDraftChange,
  onReportComment,
  onSubmit,
}: {
  comments: CommentItem[];
  draft: CommentDraft;
  isLoading: boolean;
  post: Post | null;
  profile: Profile | null;
  user: User | null;
  onClose: () => void;
  onDeleteComment: (commentId: string) => void;
  onDraftChange: (draft: CommentDraft) => void;
  onReportComment: (comment: CommentItem) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!post) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/[0.78] px-4 backdrop-blur-md">
      <div className="glass-panel neon-card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg p-5 shadow-2xl">
        <ModalHeader eyebrow="Advice Thread" title={post.title} onClose={onClose} />

        <div className="mt-5 space-y-3">
          {isLoading ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
              正在同步支招记录...
            </p>
          ) : null}

          {comments.map((comment) => (
            <div
              className="rounded-lg border border-white/10 bg-white/[0.045] p-4"
              key={comment.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {comment.display_name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatRelativeTime(comment.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <IconButton
                    icon={ShieldAlert}
                    label="上报 HR 审查"
                    onClick={() => onReportComment(comment)}
                  />
                  {user?.id === comment.user_id ? (
                    <IconButton
                      icon={Trash2}
                      label="删除"
                      onClick={() => onDeleteComment(comment.id)}
                      tone="danger"
                    />
                  ) : null}
                </div>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {comment.content}
              </p>
            </div>
          ))}

          {!isLoading && comments.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
              还没有支招，来当第一个递纸巾的人。
            </p>
          ) : null}
        </div>

        <form className="mt-5 space-y-4 border-t border-white/10 pt-4" onSubmit={onSubmit}>
          <FormTextarea
            label="支招一下"
            maxLength={500}
            onChange={(value) => onDraftChange({ ...draft, content: value })}
            placeholder="支个招，或者一起破防..."
            value={draft.content}
          />
          <AnonymousControls
            anonymousMode={draft.anonymousMode}
            realName={profile?.username ?? user?.email ?? "真实 username"}
            onAnonymousModeChange={(value) =>
              onDraftChange({ ...draft, anonymousMode: value })
            }
          />
          <ModalActions
            cancelLabel="关掉"
            submitLabel={user ? "发射支招" : "请先登录"}
            submitDisabled={!user}
            onCancel={onClose}
          />
        </form>
      </div>
    </div>
  );
}

function ReportModal({
  draft,
  target,
  user,
  onClose,
  onDraftChange,
  onSubmit,
}: {
  draft: ReportDraft;
  target: ReportTarget | null;
  user: User | null;
  onClose: () => void;
  onDraftChange: (draft: ReportDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!target) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/[0.78] px-4 backdrop-blur-md">
      <div className="glass-panel neon-card w-full max-w-xl rounded-lg p-5 shadow-2xl">
        <ModalHeader eyebrow="HR Review" title="上报 HR 审查" onClose={onClose} />
        <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
          {target.type === "post" ? "帖子" : "支招"}：{target.label}
        </p>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium text-slate-200" htmlFor="reason">
              上报原因
            </label>
            <select
              className="mt-2 h-12 w-full rounded-lg border border-cyan-300/20 bg-[#111427] px-3 text-white outline-none transition focus:border-cyan-300/60"
              id="reason"
              onChange={(event) =>
                onDraftChange({ ...draft, reason: event.target.value })
              }
              value={draft.reason}
            >
              {reportReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>
          <FormTextarea
            label="补充说明"
            maxLength={500}
            onChange={(value) => onDraftChange({ ...draft, details: value })}
            placeholder="可选，说明为什么需要 HR 审查..."
            value={draft.details}
          />
          <ModalActions
            cancelLabel="取消"
            submitLabel={user ? "提交 HR 审查" : "请先登录"}
            submitDisabled={!user}
            onCancel={onClose}
          />
        </form>
      </div>
    </div>
  );
}

function AnonymousControls({
  anonymousMode,
  realName,
  onAnonymousModeChange,
}: {
  anonymousMode: boolean;
  realName: string;
  onAnonymousModeChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-slate-200">
            anonymous_mode
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            开启后前台显示 anonymous_name，不显示真实 username
          </span>
        </span>
        <input
          checked={anonymousMode}
          className="h-5 w-5 accent-cyan-300"
          onChange={(event) => onAnonymousModeChange(event.target.checked)}
          type="checkbox"
        />
      </label>

      {anonymousMode ? (
        <p className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-2 text-sm text-cyan-100">
          提交时会自动生成匿名身份，例如：赛博牛马 #1024、工位幽灵 #996、摸鱼观察员 #233。
        </p>
      ) : (
        <p className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-2 text-sm text-emerald-100">
          将显示真实 username：{realName}
        </p>
      )}
    </div>
  );
}

function ModalHeader({
  eyebrow,
  title,
  onClose,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-200/70">
          {eyebrow}
        </p>
        <h2 className="mt-2 line-clamp-2 text-2xl font-semibold text-white">
          {title}
        </h2>
      </div>
      <button
        aria-label="关闭弹窗"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-slate-300 transition hover:border-fuchsia-300/40 hover:text-white"
        onClick={onClose}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ModalActions({
  cancelLabel,
  submitLabel,
  submitDisabled,
  onCancel,
}: {
  cancelLabel: string;
  submitLabel: string;
  submitDisabled?: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
      <button
        className="inline-flex h-11 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.05] px-4 text-sm font-semibold text-slate-200 transition hover:border-white/25 hover:text-white"
        onClick={onCancel}
        type="button"
      >
        {cancelLabel}
      </button>
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-300 via-sky-400 to-fuchsia-400 px-5 text-sm font-semibold text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.25)] transition hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
        disabled={submitDisabled}
        type="submit"
      >
        <Send className="h-4 w-4" />
        {submitLabel}
      </button>
    </div>
  );
}

function FormInput({
  label,
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-200">{label}</label>
      <input
        className="mt-2 h-12 w-full rounded-lg border border-cyan-300/20 bg-white/[0.06] px-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:bg-cyan-300/10"
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}

function FormTextarea({
  label,
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-200">{label}</label>
      <textarea
        className="mt-2 min-h-28 w-full resize-none rounded-lg border border-cyan-300/20 bg-white/[0.06] px-3 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:bg-cyan-300/10"
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}

function IconButton({
  active = false,
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  active?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
        tone === "danger"
          ? "border-rose-300/25 bg-rose-300/[0.08] text-rose-100 hover:border-rose-300/50"
          : active
            ? "border-amber-300/35 bg-amber-300/[0.12] text-amber-100"
          : "border-white/10 bg-white/[0.05] text-slate-200 hover:border-cyan-300/35 hover:text-cyan-100"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <Icon className="h-3.5 w-3.5 text-cyan-200" />
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function MoodMeter({ score }: { score: number }) {
  const level = getMoodLevel(score);

  return (
    <div className="rounded-lg border border-cyan-300/15 bg-white/[0.035] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Gauge className={`h-3.5 w-3.5 ${level.text}`} />
          mood_score 破防指数
        </p>
        <p className={`font-mono text-sm font-semibold ${level.text}`}>
          {score} · {level.label}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {moodLevels.map((item) => (
          <span
            aria-label={`${item.score} ${item.label}`}
            className={`h-2 rounded-full transition ${
              item.score <= score
                ? `bg-gradient-to-r ${level.tone} shadow-[0_0_14px_rgba(34,211,238,0.18)]`
                : "bg-white/[0.08]"
            }`}
            key={item.score}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[10px] text-slate-500">
        {moodLevels.map((item) => (
          <span className={item.score === score ? item.text : ""} key={item.score}>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SignalStat({
  accent,
  icon: Icon,
  label,
  value,
}: {
  accent: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <Icon className={`h-3.5 w-3.5 ${accent}`} />
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function getCategoryLabel(categoryId: string) {
  return categories.find((category) => category.id === categoryId)?.label ?? categoryId;
}

function getCategoryIcon(categoryId: string) {
  return categoryId in categoryIconMap
    ? categoryIconMap[categoryId as CategoryId]
    : Hash;
}

function getMoodScore(post: Pick<Post, "mood_score" | "meltdown">) {
  if (Number.isFinite(post.mood_score)) {
    return clampMoodScore(post.mood_score);
  }

  return clampMoodScore(Math.round(post.meltdown / 20));
}

function getMoodLevel(score: number) {
  const normalizedScore = clampMoodScore(score);

  return moodLevels.find((level) => level.score === normalizedScore) ?? moodLevels[2];
}

function clampMoodScore(score: number) {
  return Math.min(5, Math.max(1, Math.round(score)));
}

function formatCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return `${value}`;
}

function formatRelativeTime(value: string) {
  const time = new Date(value).getTime();
  const diff = Math.max(0, Date.now() - time);
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) {
    return "刚刚";
  }
  if (minutes < 60) {
    return `${minutes}分钟前`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}小时前`;
  }

  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

function sumBy(posts: Post[], key: "comment_count" | "reaction_count") {
  return posts.reduce((sum, post) => sum + post[key], 0);
}
