import {
  BarChart3,
  MessageCircle,
  Globe2,
  Camera,
  Droplets,
  QrCode,
  Trees,
  Newspaper,
  Trophy,
  ShoppingBag,
  LucideIcon,
} from "lucide-react"

export type TabId =
  | "analysis"
  | "water"
  | "coaching"
  | "certification"
  | "campaign"
  | "ecoCity"
  | "feed"
  | "leaderboard"
  | "carbonMap"
  | "shop"

export type TabMeta = {
  id: TabId
  navLabel: string
  title: string
  subtitle: string
  Icon: LucideIcon
}

export const MAIN_TAB_IDS: TabId[] = ["analysis", "coaching", "certification", "carbonMap"]

export const TAB_META: TabMeta[] = [
  {
    id: "analysis",
    navLabel: "분석",
    title: "탄소 분석",
    subtitle: "교통·식단·주거 패턴을 기록하고 개인 탄소 배출량을 추적해요",
    Icon: BarChart3,
  },
  {
    id: "coaching",
    navLabel: "AI",
    title: "AI 코칭",
    subtitle: "내 상황에 맞춘 에너지 절약 플랜을 받아요",
    Icon: MessageCircle,
  },
  {
    id: "carbonMap",
    navLabel: "탄소맵",
    title: "서울 탄소맵",
    subtitle: "지역·주거별 탄소 배출 현황을 한눈에",
    Icon: Globe2,
  },
  {
    id: "certification",
    navLabel: "인증",
    title: "친환경 인증",
    subtitle: "사진으로 실천을 인증하고 포인트를 모아요",
    Icon: Camera,
  },
  {
    id: "water",
    navLabel: "물",
    title: "물 발자국",
    subtitle: "물 사용량과 오염도 지표를 함께 확인해요",
    Icon: Droplets,
  },
  {
    id: "campaign",
    navLabel: "캠페인",
    title: "탄소중립 캠페인",
    subtitle: "MBTI 테스트, 착한행동, 오늘의 탄소발자국",
    Icon: QrCode,
  },
  {
    id: "ecoCity",
    navLabel: "도시",
    title: "에코 인프라",
    subtitle: "포인트로 도시 인프라가 성장해요",
    Icon: Trees,
  },
  {
    id: "feed",
    navLabel: "피드",
    title: "시민 기자단",
    subtitle: "꿀팁을 공유하고 좋아요로 주간 보상을 노려요",
    Icon: Newspaper,
  },
  {
    id: "leaderboard",
    navLabel: "랭킹",
    title: "리더보드",
    subtitle: "친구들과 포인트·절약량을 비교해요",
    Icon: Trophy,
  },
  {
    id: "shop",
    navLabel: "상점",
    title: "포인트 상점",
    subtitle: "포인트로 굿즈/상품을 교환해요",
    Icon: ShoppingBag,
  },
]

export function getTabMeta(id: string | null | undefined) {
  return TAB_META.find((t) => t.id === id) ?? TAB_META[0]
}