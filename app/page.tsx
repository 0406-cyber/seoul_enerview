"use client"

// ❌ export const runtime = "edge"; (삭제됨: Cloudflare 서버 액션 충돌 방지)
export const runtime = "edge";
import { useState, useCallback, useEffect, useMemo } from "react"
import { Leaf } from "lucide-react"
import { toast } from "sonner"
import { BottomNav } from "@/components/bottom-nav"
import { AnalysisTab } from "@/components/tabs/analysis-tab"
import { WaterFootprintTab } from "@/components/tabs/water-footprint-tab"
import { CoachingTab } from "@/components/tabs/coaching-tab"
import { CertificationTab } from "@/components/tabs/certification-tab"
import { LeaderboardTab } from "@/components/tabs/leaderboard-tab"
import { EcoCityTab } from "@/components/tabs/eco-city-tab"
import { CitizenFeedTab } from "@/components/tabs/citizen-feed-tab"
import { OnboardingScreen } from "@/components/onboarding-screen"
import {
  computeCo2Kg,
  saveUsage,
  loginUser,
  updateUserPoints,
  getLeaderboardViaApi,
} from "@/lib/googleSheets"
import {
  getGemmaAdvice,
  askGemmaCustomQuestion,
  analyzeImageWithGemini,
} from "@/lib/gemini"
import { loadUsageHistory, appendUsageLocal, type UsageRecord } from "@/lib/usage-storage"
import { loadPoints, savePoints } from "@/lib/points-storage"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

interface CertificationHistory {
  id: string
  date: string
  type: string
  points: number
}

interface LeaderboardEntry {
  id: string
  rank: number
  name: string
  points: number
  carbonSaved: number
  streak: number
}

export default function Home() {
  const [nickname, setNickname] = useState<string | null>(null)
  const [isOnboarded, setIsOnboarded] = useState(false)
  const [activeTab, setActiveTab] = useState("analysis")
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  
  // 실시간 리더보드 데이터를 저장할 상태
  const [remoteUsers, setRemoteUsers] = useState<Omit<LeaderboardEntry, "rank">[]>([])

  const [electricityUsage, setElectricityUsage] = useState("")
  const [gasUsage, setGasUsage] = useState("")
  const [carbonEmission, setCarbonEmission] = useState<number | null>(null)
  const [usageHistory, setUsageHistory] = useState<UsageRecord[]>([])
  const [isSavingUsage, setIsSavingUsage] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [isCoachingLoading, setIsCoachingLoading] = useState(false)

  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [points, setPoints] = useState(100)
  const [certificationHistory, setCertificationHistory] = useState<CertificationHistory[]>([])

  useEffect(() => {
    if (!nickname) return
    setUsageHistory(loadUsageHistory(nickname))
  }, [nickname])

  useEffect(() => {
    if (!nickname) return
    const p = loadPoints(nickname, 100)
    setPoints(p)
  }, [nickname])

  useEffect(() => {
    if (!nickname) return
    savePoints(nickname, points)
  }, [nickname, points])

  // 기존 useEffect들 아래에 추가
  useEffect(() => {
    const savedNickname = localStorage.getItem("eco_nickname")
    if (savedNickname) {
      setNickname(savedNickname)
      setIsOnboarded(true)
    }
  }, [])

  // ✅ 수정됨: useEffect 안에서 return JSX를 하면 에러가 나므로 에러는 toast로 처리합니다.
  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const data = await getLeaderboardViaApi();
        if (data && data.length > 0) {
          setRemoteUsers(data);
        }
      } catch (e: any) {
        console.error("리더보드 로드 에러:", e.message);
        toast.error("리더보드를 불러오지 못했습니다: " + e.message);
      }
    };
    loadLeaderboard();
  }, []);

  const chartData = useMemo(
    () =>
      usageHistory.map((u) => ({
        date: u.date,
        carbon: u.co2_kg,
      })),
    [usageHistory]
  )
  
  const leaderboard: LeaderboardEntry[] = useMemo(() => {
    const currentUser: Omit<LeaderboardEntry, "rank"> = {
      id: "current",
      name: nickname || "나",
      points,
      carbonSaved: Math.floor(points / 50),
      streak: 1,
    };

    // 서버 데이터에서 현재 사용자와 동일한 닉네임 제거 (중복 방지)
    const filteredRemoteUsers = remoteUsers.filter(user => user.name !== nickname);

    const allUsers = [...filteredRemoteUsers, currentUser];

    return allUsers
      .sort((a, b) => b.points - a.points)
      .map((user, index) => ({ ...user, rank: index + 1 }));
  }, [nickname, points, remoteUsers]);
    


  const handleOnboardingComplete = useCallback(async (name: string) => {
    setNickname(name)
    setIsOnboarded(true)
    
    // 로컬 스토리지에 사용자 정보 저장
    localStorage.setItem("eco_nickname", name)

    setPoints(loadPoints(name, 100))
    setUsageHistory(loadUsageHistory(name))
    try {
      await loginUser(name)
    } catch (e: any) {
      console.error("온보딩 로그인 에러:", e.message);
    }
  }, [])

  const awardPoints = useCallback((delta: number, _reason: string) => {
    // reason is kept for future audit/log UI
    setPoints((p) => p + delta)
  }, [])

  const handleAdminLogin = useCallback(() => {
    if (adminPassword === "seoul1234") {
      setIsAdminAuthenticated(true)
      toast.success("관리자 인증 성공! 대시보드를 불러옵니다.")
    } else {
      toast.error("비밀번호가 일치하지 않습니다.")
    }
  }, [adminPassword])

  const handleAdminLogout = useCallback(() => {
    setIsAdminAuthenticated(false)
    setNickname(null)
    setIsOnboarded(false)
    setAdminPassword("")
    
    // 로컬 스토리지에서 사용자 정보 삭제
    localStorage.removeItem("eco_nickname")
  }, [])
  const handleLogout = useCallback(() => {
    localStorage.removeItem("eco_nickname"); // 저장된 닉네임 삭제
    setNickname(null);
    setIsOnboarded(false);
    setIsAdminAuthenticated(false);
    setAdminPassword("");
    toast.success("로그아웃 되었습니다.");
  }, []);
  // ✅ 수정됨: 서버 액션(computeCo2Kg 등) 호출 시 에러가 나면 앱이 멈추지 않고 에러 메시지를 보여줍니다.
  const handleCalculate = useCallback(async () => {
    if (!nickname) {
      toast.error("닉네임이 없습니다. 온보딩을 다시 진행해 주세요.")
      return
    }

    setIsSavingUsage(true);
    
    try {
      const electricity = parseFloat(electricityUsage) || 0
      const gas = parseFloat(gasUsage) || 0
      
      // 서버 액션 호출 (여기서 에러가 나면 바로 catch로 이동)
      const emission = await computeCo2Kg(electricity, gas)
      setCarbonEmission(emission)
      
      const row: UsageRecord = {
        date: new Date().toISOString().slice(0, 10),
        elec_kwh: electricity,
        gas_m3: gas,
        co2_kg: emission,
      }
      const next = appendUsageLocal(nickname, row)
      setUsageHistory(next)

      await saveUsage(nickname, electricity, gas, emission)
      toast.success("데이터가 성공적으로 기록되었습니다!")
      
    } catch (e: any) {
      console.error("계산/저장 에러:", e.message);
      toast.error("서버 처리 중 에러가 발생했습니다: " + e.message);
    } finally {
      setIsSavingUsage(false)
    }
  }, [nickname, electricityUsage, gasUsage])

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    }
    setMessages((prev) => [...prev, userMessage])
    setIsCoachingLoading(true)
    try {
      const response = await askGemmaCustomQuestion(content)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response,
        },
      ])
    } catch (e: any) {
      toast.error("AI 응답 실패: " + e.message)
    } finally {
      setIsCoachingLoading(false)
    }
  }, [])

  const handleRequestAdvice = useCallback(async () => {
    setIsCoachingLoading(true)
    try {
      if (usageHistory.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: "먼저 '에너지 사용 분석' 탭에서 데이터를 기록해주세요.",
          },
        ])
        return
      }

      const latest = usageHistory[usageHistory.length - 1]
      const advice = await getGemmaAdvice(
        latest.elec_kwh,
        latest.gas_m3,
        latest.co2_kg
      )
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: advice,
        },
      ])
    } catch (e: any) {
      toast.error("조언 요청 실패: " + e.message)
    } finally {
      setIsCoachingLoading(false)
    }
  }, [usageHistory])
  const handleCertify = useCallback(async (): Promise<{
    ok: boolean
    earnedPoints?: number
    error?: string
  }> => {
    if (!nickname || !selectedImage) {
      toast.error("닉네임 또는 이미지가 필요합니다.")
      return { ok: false, error: "missing" }
    }

    try {
      const { result, error } = await analyzeImageWithGemini(selectedImage)
      if (error || !result) {
        toast.error(error || "이미지 분석에 실패했습니다.")
        return { ok: false, error: error ?? undefined }
      }

      if (String(result.action_found).toLowerCase() !== "true") {
        toast.warning(
          "AI가 사진에서 명확한 에너지 절약 행동을 인식하지 못했습니다."
        )
        return { ok: false, error: "no_action" }
      }

      const rawKwh = result.estimated_save_kwh ?? "0"
      const match = String(rawKwh).match(/[\d.]+/)
      const savedKwh = match ? parseFloat(match[0]) : 0
      const gainedPoints = Math.max(
        10,
        Math.min(500, Math.floor(savedKwh * 100))
      )

      try {
        // 1. 서버에 포인트 업데이트 먼저 요청
        await updateUserPoints(nickname, gainedPoints)
        
        // 2. 서버 통신 성공 시에만 로컬 포인트 및 인증 내역 업데이트
        setPoints((p) => p + gainedPoints)
        const description = result.description || "에너지 절약 행동"
        setCertificationHistory((prev) => [
          {
            id: Date.now().toString(),
            date: new Date()
              .toLocaleDateString("ko-KR")
              .replace(/\. /g, ".")
              .slice(0, -1),
            type: description,
            points: gainedPoints,
          },
          ...prev,
        ])

        return { ok: true, earnedPoints: gainedPoints }
      } catch (e: any) {
        console.error("포인트 업데이트 에러:", e.message);
        toast.error("서버와 동기화하는 중 문제가 발생했습니다. 포인트를 저장할 수 없습니다.");
        return { ok: false, error: "sync_failed" }
      }

    } catch (e: any) {
      toast.error(e.message)
      return { ok: false, error: e.message }
    }
  }, [nickname, selectedImage])
  const getTabTitle = () => {
    switch (activeTab) {
      case "analysis": return "탄소 분석"
      case "water": return "물 발자국"
      case "coaching": return "AI 코칭"
      case "certification": return "친환경 인증"
      case "ecoCity": return "에코 시티"
      case "feed": return "시민 기자단"
      case "leaderboard": return "리더보드"
      default: return "Unknown"
    }
  }

  if (!isOnboarded) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />
  }

  if (nickname === "admin") {
    if (!isAdminAuthenticated) {
      return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
          <div className="bg-card p-8 rounded-2xl border border-border w-full max-w-sm flex flex-col gap-6 shadow-lg">
            <div>
              <h2 className="text-xl font-bold text-foreground">🔒 관리자 권한 인증</h2>
              <p className="text-sm text-muted-foreground mt-2">대시보드에 접근하려면 비밀번호가 필요합니다.</p>
            </div>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="관리자 비밀번호 입력"
              className="bg-background text-foreground border border-border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary w-full"
              onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
            />
            <button
              onClick={handleAdminLogin}
              className="bg-primary text-primary-foreground font-bold rounded-xl p-3 hover:bg-primary/90 transition w-full"
            >
              인증하기
            </button>
          </div>
        </main>
      )
    }

    return (
      <main className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto flex flex-col gap-6 mt-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">🛠️ 통합 관리자 대시보드</h1>
            <button 
              onClick={handleAdminLogout} 
              className="text-sm bg-secondary text-secondary-foreground px-4 py-2 rounded-xl font-medium"
            >
              로그아웃
            </button>
          </div>
          
          <div className="bg-card p-6 rounded-2xl border border-border flex flex-col gap-4 shadow-sm">
            <h2 className="text-lg font-bold text-foreground">👥 전체 사용자 기본 현황</h2>
            <div className="flex justify-between items-center bg-background p-4 rounded-xl border border-border">
              <span className="text-sm text-muted-foreground">현재 활성 가입자 수</span>
              <span className="text-lg font-bold text-foreground">
                {leaderboard ? Math.max(0, leaderboard.length - 1) : 0} 명
              </span>
            </div>
          </div>

          <div className="bg-primary/10 p-6 rounded-2xl border border-primary/20">
            <p className="text-sm text-primary font-medium text-center">
              ※ 전체 사용량 상세 데이터 및 오류 로그(logs)는 연동된 구글 시트에서 직접 확인 및 관리하실 수 있습니다.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            
            {/* 1. 왼쪽 영역: 로고 및 타이틀 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">
                  {getTabTitle()}
                </h1>
                <p className="text-xs text-muted-foreground">
                  탄소 절약 & AI 에너지 코칭
                </p>
              </div>
            </div>

            {/* 2. 오른쪽 영역: 포인트와 로그아웃 버튼을 하나로 묶음 */}
            <div className="flex items-center gap-2">
              
              {/* 포인트 배지 */}
              <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">
                    {nickname?.charAt(0)}
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground">
                  {points}P
                </span>
              </div>

              {/* 로그아웃 버튼 */}
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-secondary rounded-xl transition-colors text-muted-foreground"
                title="로그아웃"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>

            </div>

          </div>
        </div>
      </header>
      
      <div className="max-w-md mx-auto px-4 py-6">
        {activeTab === "analysis" && (
          <AnalysisTab
            electricityUsage={electricityUsage}
            gasUsage={gasUsage}
            onElectricityChange={setElectricityUsage}
            onGasChange={setGasUsage}
            onCalculate={handleCalculate}
            carbonEmission={carbonEmission}
            chartData={chartData}
            isSaving={isSavingUsage}
          />
        )}

        {activeTab === "water" && (
          <WaterFootprintTab />
        )}

        {activeTab === "coaching" && (
          <CoachingTab
            messages={messages}
            onSendMessage={handleSendMessage}
            onRequestAdvice={handleRequestAdvice}
            isLoading={isCoachingLoading}
          />
        )}

        {activeTab === "certification" && (
          <CertificationTab
            selectedImage={selectedImage}
            onImageSelect={setSelectedImage}
            onCertify={handleCertify}
            points={points}
            certificationHistory={certificationHistory}
          />
        )}

        {activeTab === "ecoCity" && nickname && (
          <EcoCityTab nickname={nickname} points={points} />
        )}

        {activeTab === "feed" && nickname && (
          <CitizenFeedTab
            nickname={nickname}
            onAwardPoints={(delta, reason) => awardPoints(delta, reason)}
          />
        )}

        {activeTab === "leaderboard" && (
          <LeaderboardTab entries={leaderboard} currentUserId="current" />
        )}
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  )
}
