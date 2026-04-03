"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Heart, ImagePlus, Crown, Send, X } from "lucide-react"
import {
  CitizenPost,
  loadClaims,
  loadFeedAsync,       // ⭐️ 변경됨
  markClaimed,
  saveNewPostAsync,    // ⭐️ 변경됨
  updateLikesAsync,    // ⭐️ 추가됨
  weekKey,
} from "@/lib/citizen-feed-storage"

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function clampText(s: string, max = 200) {
  const t = s.trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

export function CitizenFeedTab({
  nickname,
  onAwardPoints,
}: {
  nickname: string
  onAwardPoints: (delta: number, reason: string) => void
}) {
  const [posts, setPosts] = useState<CitizenPost[]>([])
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false) // ⭐️ 제출 중 방지 상태
  const fileRef = useRef<HTMLInputElement>(null)

  // ⭐️ 비동기 피드 불러오기
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const p = await loadFeedAsync()
        setPosts(p.sort((a, b) => b.createdAt - a.createdAt))
      } catch (error) {
        console.error("피드 불러오기 실패:", error)
      }
    }
    fetchPosts()
  }, [])

  const stats = useMemo(() => {
    const week = weekKey(new Date())
    const weekPosts = posts.filter((p) => weekKey(new Date(p.createdAt)) === week)

    const likesReceived: Record<string, number> = {}
    for (const p of weekPosts) {
      likesReceived[p.author] = (likesReceived[p.author] ?? 0) + (p.likedBy?.length ?? 0)
    }

    const ranked = Object.entries(likesReceived)
      .map(([author, likes]) => ({ author, likes }))
      .sort((a, b) => b.likes - a.likes)

    const top = ranked[0] ?? null
    const claims = loadClaims()
    const claimedBy = claims[week] ?? null

    return { week, weekPosts, ranked, top, claimedBy }
  }, [posts])

  const canClaim = useMemo(() => {
    if (!stats.top) return false
    if (stats.top.likes <= 0) return false
    if (stats.claimedBy) return false
    return stats.top.author === nickname
  }, [nickname, stats.claimedBy, stats.top])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => setImageDataUrl(event.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ⭐️ 비동기 새 글 작성
  const handlePost = async () => {
    const t = clampText(title, 60)
    const b = clampText(body, 400)
    if (!t || !b || isSubmitting) return

    setIsSubmitting(true)

    const newPost: CitizenPost = {
      id: uid(),
      author: nickname,
      title: t,
      body: b,
      imageDataUrl,
      createdAt: Date.now(),
      likedBy: [],
    }
    
    // 화면에 먼저 반영 (낙관적 업데이트)
    setPosts(prev => [newPost, ...prev].sort((a, b) => b.createdAt - a.createdAt))
    setTitle("")
    setBody("")
    setImageDataUrl(undefined)

    try {
      // 구글 시트에 저장
      await saveNewPostAsync(newPost)
    } catch (e) {
      console.error("새 글 저장 실패:", e)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ⭐️ 비동기 좋아요 토글
  const toggleLike = async (postId: string) => {
    const targetPost = posts.find((p) => p.id === postId)
    if (!targetPost) return

    const likedBy = Array.isArray(targetPost.likedBy) ? targetPost.likedBy : []
    const hasLiked = likedBy.includes(nickname)
    const updatedLikedBy = hasLiked
      ? likedBy.filter((u) => u !== nickname)
      : [...likedBy, nickname]

    // 화면에 먼저 반영 (낙관적 업데이트)
    const next = posts.map((p) => {
      if (p.id !== postId) return p
      return { ...p, likedBy: updatedLikedBy }
    })
    setPosts(next.sort((a, b) => b.createdAt - a.createdAt))

    try {
      // 구글 시트에 좋아요 내역 반영
      await updateLikesAsync(postId, updatedLikedBy)
    } catch (e) {
      console.error("좋아요 업데이트 실패:", e)
    }
  }

  const claimWeeklyReward = () => {
    if (!stats.top) return
    if (!canClaim) return
    const BONUS = 200
    markClaimed(stats.week, nickname)
    onAwardPoints(BONUS, "시민 기자단 주간 1등 보상")
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="bg-card rounded-3xl p-6 border border-border">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">시민 기자단</p>
            <h3 className="text-xl font-bold text-foreground truncate">에코 꿀팁 공유 피드</h3>
            <p className="text-sm text-muted-foreground mt-1">
              사진 + 짧은 기사처럼 공유하고, 좋아요 1등은 주간 보너스 포인트!
            </p>
          </div>
          <div className="w-12 h-12 rounded-3xl bg-primary/20 flex items-center justify-center">
            <Crown className="w-6 h-6 text-primary" />
          </div>
        </div>
      </div>

      {/* weekly reward banner */}
      {stats.top && stats.top.likes > 0 && (
        <div className="bg-card rounded-3xl p-6 border border-border">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">이번 주 베스트 시민 기자</p>
              <p className="text-lg font-bold text-foreground truncate">
                {stats.top.author} · 좋아요 {stats.top.likes}개
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {stats.claimedBy ? `보상 지급 완료 (${stats.claimedBy})` : "보상 미지급"}
              </p>
            </div>
            <button
              onClick={claimWeeklyReward}
              disabled={!canClaim}
              className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {canClaim ? "보상 받기 (+200P)" : "보상 받기"}
            </button>
          </div>
        </div>
      )}

      {/* composer */}
      <div className="bg-card rounded-3xl p-6 border border-border space-y-4">
        <h3 className="text-lg font-semibold text-foreground">새 글 작성</h3>

        <input
          type="file"
          ref={fileRef}
          onChange={handleFileSelect}
          accept="image/*"
          className="hidden"
        />

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예) 텀블러 30일 챌린지 후기"
            className="w-full bg-secondary rounded-2xl px-5 py-4 text-base font-medium text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">내용</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="짧은 기사/SNS 스토리처럼 공유해보세요. (분리수거 팁, 생활 실천, before/after 등)"
            className="w-full min-h-28 bg-secondary rounded-2xl px-5 py-4 text-base font-medium text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
          />
        </div>

        {!imageDataUrl ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full bg-secondary rounded-2xl py-4 border border-border hover:border-primary/40 transition flex items-center justify-center gap-2 text-foreground font-semibold"
          >
            <ImagePlus className="w-5 h-5 text-primary" />
            사진 추가
          </button>
        ) : (
          <div className="relative">
            <div className="aspect-[16/9] rounded-2xl overflow-hidden bg-secondary border border-border">
              <Image src={imageDataUrl} alt="post image" fill unoptimized className="object-cover" />
            </div>
            <button
              onClick={() => setImageDataUrl(undefined)}
              className="absolute top-3 right-3 w-10 h-10 rounded-2xl bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>
        )}

        <button
          onClick={handlePost}
          disabled={!title.trim() || !body.trim() || isSubmitting}
          className="w-full bg-primary text-primary-foreground rounded-2xl py-4 text-lg font-semibold transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Send className="w-5 h-5" />
          {isSubmitting ? "게시 중..." : "게시하기"}
        </button>
      </div>

      {/* feed */}
      <div className="space-y-3">
        {posts.length === 0 ? (
          <div className="bg-card rounded-3xl p-10 border border-border text-center text-muted-foreground">
            아직 올라온 글이 없어요. 첫 번째 시민 기자가 되어보세요!
          </div>
        ) : (
          posts.map((p) => {
            const liked = (p.likedBy ?? []).includes(nickname)
            const likeCount = p.likedBy?.length ?? 0
            return (
              <div key={p.id} className="bg-card rounded-3xl border border-border overflow-hidden">
                {p.imageDataUrl && (
                  <div className="relative aspect-[16/9] bg-secondary">
                    <Image src={p.imageDataUrl} alt={p.title} fill unoptimized className="object-cover" />
                  </div>
                )}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">{p.author}</p>
                      <p className="text-lg font-bold text-foreground truncate">{p.title}</p>
                    </div>
                    <button
                      onClick={() => toggleLike(p.id)}
                      className={`px-4 py-2 rounded-2xl border transition flex items-center gap-2 ${
                        liked
                          ? "bg-primary text-primary-foreground border-primary/50"
                          : "bg-secondary text-foreground border-border hover:border-primary/40"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${liked ? "" : "text-primary"}`} />
                      <span className="font-semibold">{likeCount}</span>
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleString("ko-KR")}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
