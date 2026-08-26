"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Brain,
  Sparkles,
  Heart,
  Lightbulb,
  Sun,
  Moon,
  Cloud,
  Wind,
  TreePine,
  Leaf,
  Bike,
  Droplets,
  Recycle,
  ShoppingBag,
  Coffee,
  Car,
  Plug,
  ShowerHead,
  Utensils,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Clock,
  Footprints,
  Home,
  Newspaper,
  MapPin,
  Gift,
  Trophy,
  Star,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface CampaignTabProps {
  nickname: string
  points: number
  onGrantPoints: (points: number, reason: string) => Promise<void>
}


type EcoPersonality =
  | "자연수호자" | "에코리더" | "실천하는환경가" | "관심있는시민"
  | "에코초보" | "제로웨이스터" | "에너지세이버" | "그린크리에이터"

interface QuizQuestion {
  id: number
  question: string
  options: { text: string; score: Record<EcoPersonality, number> }[]
}

const ECO_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "장을 볼 때 나는...",
    options: [
      { text: "항상 에코백 + 포장 없는 제품 선호", score: { 자연수호자: 3, 에코리더: 2, 실천하는환경가: 2, 관심있는시민: 0, 에코초보: 0, 제로웨이스터: 3, 에너지세이버: 1, 그린크리에이터: 1 } },
      { text: "가끔 에코백, 가끔 비닐봉투", score: { 자연수호자: 1, 에코리더: 1, 실천하는환경가: 3, 관심있는시민: 2, 에코초보: 0, 제로웨이스터: 1, 에너지세이버: 1, 그린크리에이터: 0 } },
      { text: "편의를 위해 비닐봉투 자주 사용", score: { 자연수호자: 0, 에코리더: 0, 실천하는환경가: 0, 관심있는시민: 1, 에코초보: 3, 제로웨이스터: 0, 에너지세이버: 0, 그린크리에이터: 0 } },
      { text: "장보기 앱으로 주문·배송", score: { 자연수호자: 0, 에코리더: 0, 실천하는환경가: 0, 관심있는시민: 0, 에코초보: 1, 제로웨이스터: 0, 에너지세이버: 2, 그린크리에이터: 1 } },
    ],
  },
  {
    id: 2,
    question: "에너지 절약에 대한 생각은?",
    options: [
      { text: "안 쓰는 플러그는 항상 뽑아둠", score: { 자연수호자: 2, 에코리더: 2, 실천하는환경가: 3, 관심있는시민: 1, 에코초보: 0, 제로웨이스터: 0, 에너지세이버: 3, 그린크리에이터: 0 } },
      { text: "LED 조명 + 대기전력 절감 노력", score: { 자연수호자: 1, 에코리더: 2, 실천하는환경가: 2, 관심있는시민: 2, 에코초보: 1, 제로웨이스터: 0, 에너지세이버: 3, 그린크리에이터: 1 } },
      { text: "필요하면 쓰고 별로 신경 안 씀", score: { 자연수호자: 0, 에코리더: 0, 실천하는환경가: 1, 관심있는시민: 2, 에코초보: 3, 제로웨이스터: 0, 에너지세이버: 0, 그린크리에이터: 0 } },
      { text: "태양광·고효율 가전에 관심 많음", score: { 자연수호자: 2, 에코리더: 3, 실천하는환경가: 1, 관심있는시민: 1, 에코초보: 0, 제로웨이스터: 0, 에너지세이버: 2, 그린크리에이터: 3 } },
    ],
  },
  {
    id: 3,
    question: "음식물 쓰레기에 대한 자세는?",
    options: [
      { text: "식재료 계획 구매로 쓰레기 최소화", score: { 자연수호자: 2, 에코리더: 1, 실천하는환경가: 2, 관심있는시민: 1, 에코초보: 0, 제로웨이스터: 3, 에너지세이버: 0, 그린크리에이터: 1 } },
      { text: "줄이려 노력하지만 가끔 버림", score: { 자연수호자: 1, 에코리더: 1, 실천하는환경가: 3, 관심있는시민: 2, 에코초보: 1, 제로웨이스터: 1, 에너지세이버: 0, 그린크리에이터: 0 } },
      { text: "나오면 바로 버리는 편", score: { 자연수호자: 0, 에코리더: 0, 실천하는환경가: 0, 관심있는시민: 1, 에코초보: 3, 제로웨이스터: 0, 에너지세이버: 0, 그린크리에이터: 0 } },
      { text: "퇴비·비료 만들기에 관심", score: { 자연수호자: 3, 에코리더: 2, 실천하는환경가: 1, 관심있는시민: 0, 에코초보: 0, 제로웨이스터: 2, 에너지세이버: 0, 그린크리에이터: 2 } },
    ],
  },
  {
    id: 4,
    question: "이동 수단은 주로?",
    options: [
      { text: "대중교통이나 자전거", score: { 자연수호자: 2, 에코리더: 1, 실천하는환경가: 2, 관심있는시민: 2, 에코초보: 1, 제로웨이스터: 0, 에너지세이버: 1, 그린크리에이터: 0 } },
      { text: "전기차나 하이브리드", score: { 자연수호자: 1, 에코리더: 3, 실천하는환경가: 1, 관심있는시민: 1, 에코초보: 0, 제로웨이스터: 0, 에너지세이버: 2, 그린크리에이터: 2 } },
      { text: "자가용 + 카풀 실천", score: { 자연수호자: 0, 에코리더: 2, 실천하는환경가: 2, 관심있는시민: 2, 에코초보: 1, 제로웨이스터: 0, 에너지세이버: 1, 그린크리에이터: 0 } },
      { text: "주로 자가용, 대중교통 거의 X", score: { 자연수호자: 0, 에코리더: 0, 실천하는환경가: 0, 관심있는시민: 0, 에코초보: 3, 제로웨이스터: 0, 에너지세이버: 0, 그린크리에이터: 0 } },
    ],
  },
  {
    id: 5,
    question: "일회용품에 대한 생각은?",
    options: [
      { text: "텀블러·도시락 항상 지참", score: { 자연수호자: 3, 에코리더: 2, 실천하는환경가: 2, 관심있는시민: 0, 에코초보: 0, 제로웨이스터: 3, 에너지세이버: 0, 그린크리에이터: 1 } },
      { text: "줄이려고 노력 중", score: { 자연수호자: 1, 에코리더: 1, 실천하는환경가: 3, 관심있는시민: 2, 에코초보: 1, 제로웨이스터: 1, 에너지세이버: 0, 그린크리에이터: 0 } },
      { text: "배달음식 자주 → 일회용품 多", score: { 자연수호자: 0, 에코리더: 0, 실천하는환경가: 0, 관심있는시민: 1, 에코초보: 3, 제로웨이스터: 0, 에너지세이버: 0, 그린크리에이터: 0 } },
      { text: "리필스테이션 · 다회용기 캠페인 참여", score: { 자연수호자: 2, 에코리더: 3, 실천하는환경가: 1, 관심있는시민: 1, 에코초보: 0, 제로웨이스터: 3, 에너지세이버: 0, 그린크리에이터: 2 } },
    ],
  },
]

const PERSONALITY_INFO: Record<EcoPersonality, { icon: React.ReactNode; description: string; color: string; badge: string }> = {
  자연수호자: {
    icon: <TreePine className="w-8 h-8" />,
    description: "자연과 가장 가까운 당신! 환경 보호가 몸에 배어 있습니다.",
    color: "from-green-500 to-emerald-600",
    badge: "🌿 최상위 에코 리더",
  },
  에코리더: {
    icon: <Star className="w-8 h-8" />,
    description: "환경을 위한 행동을 주도하는 리더 유형입니다.",
    color: "from-blue-500 to-indigo-600",
    badge: "⭐ 환경 리더",
  },
  실천하는환경가: {
    icon: <Heart className="w-8 h-8" />,
    description: "꾸준히 실천하며 주변에도 선한 영향력을 주는 타입!",
    color: "from-emerald-500 to-teal-600",
    badge: "💚 꾸준한 실천가",
  },
  관심있는시민: {
    icon: <Sun className="w-8 h-8" />,
    description: "환경에 관심이 있지만 아직 실천이 더 필요한 단계입니다.",
    color: "from-yellow-500 to-orange-600",
    badge: "🌱 관심 있는 시민",
  },
  에코초보: {
    icon: <Leaf className="w-8 h-8" />,
    description: "이제 막 환경에 관심을 갖기 시작한 초보 단계입니다. 작은 것부터 시작해보세요!",
    color: "from-lime-500 to-green-600",
    badge: "🌱 에코 첫걸음",
  },
  제로웨이스터: {
    icon: <Recycle className="w-8 h-8" />,
    description: "쓰레기 제로가 목표! 분리배출과 다회용품 사용에 진심인 타입입니다.",
    color: "from-cyan-500 to-teal-600",
    badge: "♻️ 제로웨이스트",
  },
  에너지세이버: {
    icon: <Plug className="w-8 h-8" />,
    description: "에너지 절약에 탁월한 당신! 전기·가스 사용량을 꼼꼼히 관리합니다.",
    color: "from-sky-500 to-blue-600",
    badge: "⚡ 에너지 절약왕",
  },
  그린크리에이터: {
    icon: <Lightbulb className="w-8 h-8" />,
    description: "환경을 위한 혁신적인 아이디어가 가득한 창의적인 유형!",
    color: "from-violet-500 to-purple-600",
    badge: "💡 그린 크리에이터",
  },
}

// ============================================================
// 2. 탄소발자국 저감 착한 행동
// ============================================================

interface GoodAction {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  category: "에너지" | "교통" | "소비" | "음식" | "폐기물"
  co2Save: string
  difficulty: "쉬움" | "보통" | "도전"
  isDone: boolean
}

const GOOD_ACTIONS: GoodAction[] = [
  { id: "ga-1", title: "사용하지 않는 플러그 뽑기", description: "대기전력만 차단해도 연간 57kg CO₂ 절감", icon: <Plug className="w-5 h-5" />, category: "에너지", co2Save: "57kg/년", difficulty: "쉬움", isDone: false },
  { id: "ga-2", title: "LED 조명으로 교체하기", description: "백열등 대비 전력 소비 80% 감소", icon: <Lightbulb className="w-5 h-5" />, category: "에너지", co2Save: "138kg/년", difficulty: "쉬움", isDone: false },
  { id: "ga-3", title: "텀블러 사용하기", description: "종이컵 대신 텀블러 사용으로 쓰레기 감소", icon: <Coffee className="w-5 h-5" />, category: "소비", co2Save: "12kg/년", difficulty: "쉬움", isDone: false },
  { id: "ga-4", title: "대중교통 이용하기", description: "자가용 대신 지하철/버스로 출퇴근", icon: <Bike className="w-5 h-5" />, category: "교통", co2Save: "1,289kg/년", difficulty: "보통", isDone: false },
  { id: "ga-5", title: "채식 한 끼 실천하기", description: "주 1회 채식으로 육류 소비 줄이기", icon: <Utensils className="w-5 h-5" />, category: "음식", co2Save: "50kg/년", difficulty: "쉬움", isDone: false },
  { id: "ga-6", title: "샤워 시간 5분 줄이기", description: "하루 5분 단축으로 온수 사용량 감소", icon: <ShowerHead className="w-5 h-5" />, category: "에너지", co2Save: "145kg/년", difficulty: "쉬움", isDone: false },
  { id: "ga-7", title: "에코백 항상 지참", description: "비닐봉투 사용 제로에 도전!", icon: <ShoppingBag className="w-5 h-5" />, category: "소비", co2Save: "5kg/년", difficulty: "쉬움", isDone: false },
  { id: "ga-8", title: "전기차 또는 하이브리드카", description: "친환경차로 전환 시 연료비 절약 + 탄소 감축", icon: <Car className="w-5 h-5" />, category: "교통", co2Save: "2,000kg/년", difficulty: "도전", isDone: false },
  { id: "ga-9", title: "올바른 분리배출 실천", description: "재활용 가능 자원의 완벽한 분리", icon: <Recycle className="w-5 h-5" />, category: "폐기물", co2Save: "72kg/년", difficulty: "쉬움", isDone: false },
  { id: "ga-10", title: "냉장고 온도 적정하게", description: "냉장고 온도를 3℃→7℃로 설정", icon: <Wind className="w-5 h-5" />, category: "에너지", co2Save: "85kg/년", difficulty: "쉬움", isDone: false },
  { id: "ga-11", title: "빨래는 모아서 한 번에", description: "세탁기 가동 횟수 줄이기", icon: <Droplets className="w-5 h-5" />, category: "에너지", co2Save: "34kg/년", difficulty: "쉬움", isDone: false },
  { id: "ga-12", title: "걸어서 10분 거리는 걷기", description: "초근거리는 자동차 대신 도보로", icon: <Footprints className="w-5 h-5" />, category: "교통", co2Save: "76kg/년", difficulty: "쉬움", isDone: false },
]


interface StoryStep {
  time: string
  emoji: string
  title: string
  description: string
  carbonPoints: { activity: string; co2Kg: number }[]
  tips: string[]
}

const STORY_STEPS: StoryStep[] = [
  {
    time: "07:00",
    emoji: "🌅",
    title: "아침 기상",
    description: "잠에서 깨어 하루를 시작합니다. 스마트폰 알람이 울리고, 불을 켜고, 샤워를 합니다.",
    carbonPoints: [
      { activity: "스마트폰 충전 (밤새)", co2Kg: 0.02 },
      { activity: "전등 사용 30분", co2Kg: 0.05 },
      { activity: "온수 샤워 10분", co2Kg: 0.35 },
    ],
    tips: ["샤워 시간을 5분으로 줄이면 연간 145kg CO₂ 절감!", "충전기는 사용 후 반드시 플러그를 뽑아주세요."],
  },
  {
    time: "08:00",
    emoji: "☕",
    title: "출근 준비 & 아침 식사",
    description: "아침 식사를 준비하고 커피 한 잔으로 하루를 시작합니다. 출근 준비를 마칩니다.",
    carbonPoints: [
      { activity: "커피 머신 사용", co2Kg: 0.03 },
      { activity: "토스트 굽기 (전기 토스터)", co2Kg: 0.02 },
      { activity: "종이컵 1개 사용", co2Kg: 0.01 },
    ],
    tips: ["텀블러를 사용하면 하루 종이컵 3개를 절약할 수 있어요.", "에코백은 현관문 앞에 걸어두면 잊지 않아요!"],
  },
  {
    time: "09:00",
    emoji: "🚗",
    title: "출퇴근 길",
    description: "회사나 학교로 이동합니다. 선택한 교통수단에 따라 탄소 발자국이 크게 달라집니다.",
    carbonPoints: [
      { activity: "자가용 30분 운행", co2Kg: 5.2 },
      { activity: "버스 30분", co2Kg: 0.8 },
      { activity: "지하철 30분", co2Kg: 0.3 },
      { activity: "자전거/도보", co2Kg: 0.0 },
    ],
    tips: ["자가용 대신 지하철을 타면 하루 탄소 배출량이 1/6로 줄어듭니다!", "카풀도 좋은 대안이에요."],
  },
  {
    time: "12:00",
    emoji: "🍱",
    title: "점심 시간",
    description: "점심 식사를 합니다. 메뉴 선택과 배달 여부가 환경에 영향을 미칩니다.",
    carbonPoints: [
      { activity: "배달 음식 시키기", co2Kg: 0.35 },
      { activity: "고기 요리 (소고기)", co2Kg: 3.5 },
      { activity: "채식 메뉴 선택", co2Kg: 0.5 },
      { activity: "일회용 용기 1개", co2Kg: 0.05 },
    ],
    tips: ["채식 한 끼로 하루 탄소 배출량의 15%를 절감할 수 있습니다.", "배달 시 '일회용품 없이' 옵션을 선택해보세요."],
  },
  {
    time: "15:00",
    emoji: "💡",
    title: "오후 업무/활동",
    description: "사무실이나 집에서 업무를 봅니다. 디지털 기기 사용과 냉난방이 주요 배출원입니다.",
    carbonPoints: [
      { activity: "노트북 4시간 사용", co2Kg: 0.15 },
      { activity: "에어컨 2시간 사용", co2Kg: 0.8 },
      { activity: "난방 2시간", co2Kg: 1.2 },
      { activity: "LED vs 형광등 (4시간)", co2Kg: 0.08 },
    ],
    tips: ["에어컨 설정 온도를 1℃만 높여도 전력 7% 절감!", "PC는 사용 안 할 때 절전 모드로 전환하세요."],
  },
  {
    time: "19:00",
    emoji: "🏪",
    title: "퇴근 & 장보기",
    description: "퇴근 후 집으로 가는 길에 장을 봅니다. 어떤 선택을 하시나요?",
    carbonPoints: [
      { activity: "비닐봉투 1장 사용", co2Kg: 0.01 },
      { activity: "수입산 식재료 구매", co2Kg: 1.5 },
      { activity: "국내산 제철 식재료", co2Kg: 0.3 },
      { activity: "과대포장 제품 구매", co2Kg: 0.1 },
    ],
    tips: ["에코백 사용은 기본! 제철·국내산 식재료를 선택하면 탄소 발자국이 1/5로 줄어요."],
  },
  {
    time: "21:00",
    emoji: "📺",
    title: "저녁 시간",
    description: "저녁 식사 후 TV 시청이나 취미 활동으로 하루를 마무리합니다.",
    carbonPoints: [
      { activity: "TV 2시간 시청", co2Kg: 0.12 },
      { activity: "게임 콘솔 2시간", co2Kg: 0.2 },
      { activity: "조명 4시간 사용", co2Kg: 0.08 },
      { activity: "대기전력 (셋톱박스 등)", co2Kg: 0.05 },
    ],
    tips: ["사용하지 않는 가전은 플러그를 뽑아 대기전력을 차단하세요.", "취침 1시간 전 전등을 끄면 전력도 아끼고 수면에도 좋아요."],
  },
  {
    time: "23:00",
    emoji: "🌙",
    title: "취침 전",
    description: "하루를 마무리하며 내일을 준비합니다.",
    carbonPoints: [
      { activity: "스마트폰 충전 (밤새)", co2Kg: 0.02 },
      { activity: "취침 시 조명 끄기 vs 켜기", co2Kg: 0.05 },
    ],
    tips: ["취침 중에는 모든 조명을 끄면 전력 2% 절감 효과가 있습니다.", "내일의 에코 챌린지를 계획해보세요!"],
  },
]


function MbtiQuizSection({ onGrantPoints, nickname }: { onGrantPoints: (p: number, r: string) => Promise<void>; nickname: string }) {
  const [step, setStep] = useState<"start" | "quiz" | "result">("start")
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [scores, setScores] = useState<Record<EcoPersonality, number>>({
    자연수호자: 0, 에코리더: 0, 실천하는환경가: 0, 관심있는시민: 0,
    에코초보: 0, 제로웨이스터: 0, 에너지세이버: 0, 그린크리에이터: 0,
  })
  const [result, setResult] = useState<EcoPersonality | null>(null)
  const [quizCompleted, setQuizCompleted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("eco_mbti_completed_" + nickname)
    if (saved) {
      const data = JSON.parse(saved)
      setResult(data.type)
      setQuizCompleted(true)
    }
  }, [nickname])

  const handleAnswer = (option: QuizQuestion["options"][0]) => {
    const newScores = { ...scores }
    for (const [type, score] of Object.entries(option.score)) {
      newScores[type as EcoPersonality] += score
    }
    setScores(newScores)

    if (currentQuestion < ECO_QUESTIONS.length - 1) {
      setCurrentQuestion(prev => prev + 1)
    } else {
      // Calculate result
      const sorted = Object.entries(newScores).sort(([, a], [, b]) => b - a)
      const topType = sorted[0][0] as EcoPersonality
      setResult(topType)
      setStep("result")
      setQuizCompleted(true)
      localStorage.setItem("eco_mbti_completed_" + nickname, JSON.stringify({ type: topType }))
      onGrantPoints(30, "에코 MBTI 테스트 완료")
    }
  }

  const resetQuiz = () => {
    setStep("start")
    setCurrentQuestion(0)
    setScores({
      자연수호자: 0, 에코리더: 0, 실천하는환경가: 0, 관심있는시민: 0,
      에코초보: 0, 제로웨이스터: 0, 에너지세이버: 0, 그린크리에이터: 0,
    })
    setResult(null)
    setQuizCompleted(false)
    localStorage.removeItem("eco_mbti_completed_" + nickname)
  }

  if (step === "start") {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg">
          <Brain className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-xl font-bold mb-2">🌍 에코 MBTI 테스트</h3>
        <p className="text-sm text-muted-foreground mb-2">
          5가지 질문으로 알아보는 나의 환경 성향!
        </p>
        {quizCompleted ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">이미 테스트를 완료했습니다. 다시 도전?</p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" variant="outline" onClick={resetQuiz}>다시 하기</Button>
              <Button size="sm" onClick={() => setStep("result")}>결과 보기</Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setStep("quiz")} className="rounded-full px-8">
            테스트 시작하기
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    )
  }

  if (step === "quiz") {
    const q = ECO_QUESTIONS[currentQuestion]
    return (
      <div className="py-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-muted-foreground">
            {currentQuestion + 1} / {ECO_QUESTIONS.length}
          </span>
          <div className="flex gap-1">
            {ECO_QUESTIONS.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i <= currentQuestion ? "bg-primary" : "bg-secondary"}`} />
            ))}
          </div>
        </div>
        <h4 className="text-lg font-bold mb-4">{q.question}</h4>
        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(opt)}
              className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all bg-background text-sm"
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (step === "result" && result) {
    const info = PERSONALITY_INFO[result]
    return (
      <div className="py-4 text-center">
        <div className={`w-24 h-24 mx-auto mb-3 rounded-full bg-gradient-to-br ${info.color} flex items-center justify-center shadow-lg`}>
          {info.icon}
        </div>
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${info.color} mb-2`}>
          {info.badge}
        </span>
        <h3 className="text-2xl font-black mb-2">{result}</h3>
        <p className="text-sm text-muted-foreground mb-4">{info.description}</p>
        <div className="flex gap-2 justify-center">
          <Button size="sm" variant="outline" onClick={resetQuiz}>다시 테스트</Button>
          <Button size="sm" onClick={() => setStep("start")}>확인</Button>
        </div>
      </div>
    )
  }

  return null
}

function GoodActionsSection({ onGrantPoints }: { onGrantPoints: (p: number, r: string) => Promise<void> }) {
  const [actions, setActions] = useState<GoodAction[]>(GOOD_ACTIONS)
  const [filter, setFilter] = useState<string>("all")

  useEffect(() => {
    const saved = localStorage.getItem("eco_good_actions_done")
    if (saved) {
      try {
        const doneIds = JSON.parse(saved) as string[]
        setActions(prev => prev.map(a => ({ ...a, isDone: doneIds.includes(a.id) })))
      } catch {}
    }
  }, [])

  const toggleAction = (id: string) => {
    setActions(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, isDone: !a.isDone } : a)
      // Save
      const doneIds = updated.filter(a => a.isDone).map(a => a.id)
      localStorage.setItem("eco_good_actions_done", JSON.stringify(doneIds))

      // Award points on first completion
      const action = prev.find(a => a.id === id)
      if (action && !action.isDone) {
        onGrantPoints(15, `착한 행동 실천: ${action.title}`)
        toast.success(`${action.title} 인증! +15P`)
      }
      return updated
    })
  }

  const filteredActions = filter === "all" ? actions : actions.filter(a => a.category === filter)
  const doneCount = actions.filter(a => a.isDone).length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            착한 행동 체크리스트
          </h3>
          <p className="text-xs text-muted-foreground">{doneCount}/{actions.length}개 실천 중</p>
        </div>
        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
          최대 +{doneCount * 15}P
        </span>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 mb-3 overflow-x-auto no-scrollbar">
        {["all", "에너지", "교통", "소비", "음식", "폐기물"].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap transition-all ${
              filter === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {cat === "all" ? "전체" : cat}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredActions.map(action => (
          <button
            key={action.id}
            onClick={() => toggleAction(action.id)}
            className={`w-full text-left p-3 rounded-xl border transition-all ${
              action.isDone
                ? "border-primary/30 bg-primary/5 opacity-70"
                : "border-border bg-background hover:border-primary/30 hover:bg-primary/5"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                action.isDone ? "bg-primary border-primary" : "border-muted-foreground/30"
              }`}>
                {action.isDone && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-muted-foreground">{action.icon}</span>
                  <span className={`text-sm font-bold ${action.isDone ? "line-through text-muted-foreground" : ""}`}>
                    {action.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{action.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    action.difficulty === "쉬움" ? "bg-green-500/10 text-green-500" :
                    action.difficulty === "보통" ? "bg-yellow-500/10 text-yellow-500" :
                    "bg-red-500/10 text-red-500"
                  }`}>
                    {action.difficulty}
                  </span>
                  <span className="text-[10px] text-muted-foreground">🌱 {action.co2Save} 절감</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function StorySection({ onGrantPoints }: { onGrantPoints: (p: number, r: string) => Promise<void> }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [discoveredPoints, setDiscoveredPoints] = useState<string[]>([])
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("eco_story_complete")
    if (saved) setIsComplete(true)
  }, [])

  const step = STORY_STEPS[currentStep]

  const handleDiscover = (activity: string) => {
    if (!discoveredPoints.includes(activity)) {
      setDiscoveredPoints(prev => [...prev, activity])
      toast.info(`💡 발견! "${activity}"에서 탄소가 배출되고 있어요!`)
    }
  }

  const handleNextStep = () => {
    if (currentStep < STORY_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      setIsComplete(true)
      localStorage.setItem("eco_story_complete", "true")
      const bonusPoints = discoveredPoints.length * 5
      onGrantPoints(bonusPoints + 20, `스토리텔링 완료 (${discoveredPoints.length}개 발견)`)
      toast.success(`🎉 하루 스토리 완료! +${bonusPoints + 20}P`)
    }
  }

  if (isComplete) {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
          <Trophy className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-xl font-bold mb-2">🎉 오늘의 탐험 완료!</h3>
        <p className="text-sm text-muted-foreground mb-2">
          일상 속 숨겨진 탄소 배출 지점을 찾아내셨습니다.
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          매일 조금씩 바꾸면 큰 변화가 시작됩니다!
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setCurrentStep(0)
            setDiscoveredPoints([])
            setIsComplete(false)
            localStorage.removeItem("eco_story_complete")
          }}
        >
          <RefreshCw className="w-4 h-4 mr-1" /> 다시 도전
        </Button>
      </div>
    )
  }

  if (!step) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-primary" />
          하루 속 탄소 찾기
        </h3>
        <span className="text-xs text-muted-foreground">
          {currentStep + 1} / {STORY_STEPS.length}
        </span>
      </div>

      {/* Timeline indicator */}
      <div className="flex gap-1 mb-4">
        {STORY_STEPS.map((s, i) => (
          <div key={i} className={`flex-1 h-1 rounded-full ${
            i <= currentStep ? "bg-primary" : "bg-secondary"
          }`} />
        ))}
      </div>

      {/* Story Card */}
      <Card className="p-5 border-primary/10 bg-gradient-to-br from-background to-primary/5">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
            {step.emoji}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                {step.time}
              </span>
              <h4 className="font-bold">{step.title}</h4>
            </div>
            <p className="text-xs text-muted-foreground">{step.description}</p>
          </div>
        </div>

        {/* Carbon Points to Discover */}
        <div className="mb-4">
          <p className="text-xs font-bold text-muted-foreground mb-2">
            🔍 탄소 배출 지점을 찾아보세요! ({(step.carbonPoints || []).length}개)
          </p>
          <div className="space-y-1.5">
            {step.carbonPoints?.map((point, i) => {
              const isFound = discoveredPoints.includes(point.activity)
              return (
                <button
                  key={i}
                  onClick={() => handleDiscover(point.activity)}
                  disabled={isFound}
                  className={`w-full text-left p-2 rounded-lg text-xs border transition-all ${
                    isFound
                      ? "bg-primary/10 border-primary/20 text-foreground"
                      : "bg-background border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {isFound ? (
                    <div className="flex items-center justify-between">
                      <span>✅ {point.activity}</span>
                      <span className="font-bold text-primary">+{point.co2Kg}kg CO₂</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground/50">❓</span>
                      <span>숨겨진 탄소 배출 지점을 찾아 클릭!</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-background rounded-xl p-3 border border-border mb-3">
          <p className="text-[10px] font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" /> 오늘의 환경 팁
          </p>
          <ul className="space-y-1">
            {(step.tips || []).map((tip, i) => (
              <li key={i} className="text-[10px] text-muted-foreground leading-relaxed">• {tip}</li>
            ))}
          </ul>
        </div>

        <Button
          onClick={handleNextStep}
          className="w-full rounded-xl"
          disabled={(step.carbonPoints?.length || 0) > 0 && discoveredPoints.length < (step.carbonPoints?.length || 0)}
        >
          {currentStep < STORY_STEPS.length - 1 ? (
            <>
              다음 시간으로 이동 <ChevronRight className="w-4 h-4 ml-1" />
            </>
          ) : (
            <>
              하루 탐험 완료! <Trophy className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </Card>

      {/* Progress */}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>발견한 탄소 지점: {discoveredPoints.length}개</span>
        <span className="font-bold text-primary">+{discoveredPoints.length * 5}P</span>
      </div>
    </div>
  )
}

type CampaignSubTab = "mbti" | "actions" | "story"

export function CampaignTab({ nickname, points, onGrantPoints }: CampaignTabProps) {
  const [subTab, setSubTab] = useState<CampaignSubTab>("mbti")
  const campaignProgress = Math.min(points, 500)
  const progressPercent = Math.round((campaignProgress / 500) * 100)

  return (
    <div className="flex flex-col gap-6 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-br from-primary/15 via-emerald-500/10 to-sky-500/10 border-primary/20 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/15 rounded-lg">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-primary mb-0.5">{nickname ? `${nickname}님을 위한` : "나를 위한"}</p>
                <h2 className="text-xl font-bold">탄소중립 캠페인</h2>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-bold text-muted-foreground">보유 포인트</p>
              <p className="text-lg font-black text-primary">{points.toLocaleString()}P</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            작은 행동을 오늘의 변화로 연결해보세요. 테스트와 실천을 완료할 때마다 포인트가 쌓입니다.
          </p>
          <div className="mt-5 rounded-xl bg-background/70 p-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold">캠페인 진행도</span>
              <span className="font-black text-primary">{campaignProgress} / 500P</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-primary/10">
              <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {campaignProgress >= 500 ? "캠페인 목표를 달성했어요!" : `다음 실천까지 ${500 - campaignProgress}P 남았어요`}
            </p>
          </div>
        </div>
        <div className="absolute -right-4 -bottom-4 text-primary opacity-10 pointer-events-none">
          <Sparkles className="w-32 h-32" />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setSubTab("actions")}
          className="group flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
        >
          <span>
            <span className="block text-[10px] font-bold text-primary">TODAY'S ACTION</span>
            <span className="mt-1 block text-sm font-black">오늘의 행동 고르기</span>
          </span>
          <ChevronRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
        </button>
        <button
          onClick={() => setSubTab("story")}
          className="group flex items-center justify-between rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-left transition-colors hover:bg-sky-500/10"
        >
          <span>
            <span className="block text-[10px] font-bold text-sky-600 dark:text-sky-400">CARBON STORY</span>
            <span className="mt-1 block text-sm font-black">하루 탄소 여행</span>
          </span>
          <ChevronRight className="h-4 w-4 text-sky-600 dark:text-sky-400 transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      {/* Sub navigation */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: "mbti" as const, icon: <Brain className="w-4 h-4" />, label: "에코 MBTI" },
          { id: "actions" as const, icon: <Heart className="w-4 h-4" />, label: "착한행동" },
          { id: "story" as const, icon: <Clock className="w-4 h-4" />, label: "하루이야기" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
              subTab === tab.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-card border border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            {tab.icon}
            <span className="text-[10px] font-bold">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <Card className="p-5 border-border">
        {subTab === "mbti" && <MbtiQuizSection onGrantPoints={onGrantPoints} nickname={nickname} />}
        {subTab === "actions" && <GoodActionsSection onGrantPoints={onGrantPoints} />}
        {subTab === "story" && <StorySection onGrantPoints={onGrantPoints} />}
      </Card>
    </div>
  )
}