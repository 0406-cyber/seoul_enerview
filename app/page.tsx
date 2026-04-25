"use client"
export const runtime = "edge";
import { useState, useCallback, useEffect, useMemo } from "react"
import { Leaf, X } from "lucide-react" 
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
  savePointLog,     // ✨ 추가
  getPointLogs      // ✨ 추가
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

// 포인트 내역용 인터페이스 추가
interface PointHistoryItem {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export default function Home() {
  const [nickname, setNickname] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("eco_nickname");
    }
    return null;
  });

  const [isOnboarded, setIsOnboarded] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return !!localStorage.getItem("eco_nickname");
    }
    return false;
  });

  const [points, setPoints] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("eco_nickname");
      return saved ? loadPoints(saved, 100) : 100;
    }
    return 100;
  });

  const [activeTab, setActiveTab] = useState("analysis")
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  
  const [remoteUsers, setRemoteUsers] = useState<Omit<LeaderboardEntry, "rank">[]>([])
  const [electricityUsage, setElectricityUsage] = useState("")
  const [gasUsage, setGasUsage] = useState("")
  const [carbonEmission, setCarbonEmission] = useState<number | null>(null)
  const [usageHistory, setUsageHistory] = useState<UsageRecord[]>([])
  const [isSavingUsage, setIsSavingUsage] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [isCoachingLoading, setIsCoachingLoading] = useState(false)

  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [certificationHistory, setCertificationHistory] = useState<CertificationHistory[]>([])

  // 포인트 내역 상태 관리
  const [pointHistory, setPointHistory] = useState<PointHistoryItem[]>([])
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  // 포인트 기록 공통 헬퍼 함수
  const recordPoint = useCallback(async (userName: string, desc: string, amt: number) => {
    // 1. UI 즉각 반영 (낙관적 업데이트)
    setPointHistory(prev => {
      const newItem: PointHistoryItem = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString("ko-KR") + " " + new Date().toLocaleTimeString("ko-KR", {hour: '2-digit', minute:'2-digit'}),
        description: desc,
        amount: amt
      };
      return [newItem, ...prev];
    });

    // 2. 구글 시트 logs 탭에 기록
    try {
      await savePointLog(userName, desc, amt);
    } catch (e) {
      console.error("포인트 로그 구글 시트 저장 실패:", e);
    }
  }, []);

  // ⭐️ 초기 로드 시 서버 데이터 동기화 수정
  useEffect(() => {
    if (!nickname) return;

    setUsageHistory(loadUsageHistory(nickname));

    const syncWithServer = async () => {
      try {
        // 1. 리더보드 데이터 동기화
        const remoteData = await getLeaderboardViaApi();
        setRemoteUsers(remoteData);
        
        const myData = remoteData.find((u) => u.name === nickname);
        if (myData && myData.points >= 0) {
          setPoints(myData.points);
          savePoints(nickname, myData.points); 
        }

        // 2. 포인트 내역 구글 시트에서 불러오기
        const serverLogs = await getPointLogs(nickname);
        if (serverLogs && serverLogs.length > 0) {
          setPointHistory(serverLogs);
        }
      } catch (e: any) {
        console.error("서버 데이터 동기화 에러:", e.message);
      }
    };
    
    syncWithServer();
  }, [nickname]);

  useEffect(() => {
    if (!nickname) return;
    savePoints(nickname, points);
  }, [nickname, points]);

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

    const otherUsers = remoteUsers.filter(user => user.name !== nickname);
    const allUsers = [...otherUsers, currentUser]; 
    
    return allUsers
      .sort((a, b) => b.points - a.points)
      .map((user, index) => ({ ...user, rank: index + 1 }));
  }, [nickname, points, remoteUsers]);
    
  const handleOnboardingComplete = useCallback(async (name: string) => {
    localStorage.setItem("eco_nickname", name);
    setNickname(name);
    setIsOnboarded(true);
  
    try {
      const remoteData = await getLeaderboardViaApi();
      const existingUser = remoteData.find(u => u.name === name);
      
      if (existingUser) {
        setPoints(existingUser.points);
        toast.success(`${name}님, 다시 오신 것을 환영합니다!`);
      } else {
        setPoints(100);
        recordPoint(name, "신규 가입 보너스", 100); // ⭐️ 신규 가입 포인트 기록
        toast.success("가입을 축하합니다! 시작 포인트 100P가 지급되었습니다.");
      }
      
      await loginUser(name);
    } catch (e: any) {
      console.error("로그인 동기화 에러:", e.message);
      setPoints(100); 
    }
    
    setUsageHistory(loadUsageHistory(name));
  }, [recordPoint]);

  const awardPoints = useCallback((delta: number, reason: string) => {
    setPoints((p) => p + delta);
    if (nickname) {
      recordPoint(nickname, reason, delta); // ⭐️ 활동 내역 기록
    }
  }, [nickname, recordPoint])

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
    localStorage.removeItem("eco_nickname")
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem("eco_nickname");
    setNickname(null);
    setIsOnboarded(false);
    setIsAdminAuthenticated(false);
    setAdminPassword("");
    toast.success("로그아웃 되었습니다.");
  }, []);

  const handleCalculate = useCallback(async () => {
    if (!nickname) {
      toast.error("닉네임이 없습니다. 온보딩을 다시 진행해 주세요.")
      return
    }

    setIsSavingUsage(true);
    
    try {
      const electricity = parseFloat(electricityUsage) || 0
      const gas = parseFloat(gasUsage) || 0
      
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
        await updateUserPoints(nickname, gainedPoints)
        
        setPoints((p) => p + gainedPoints)
        const description = result.description || "에너지 절약 행동"
        
        // ⭐️ 포인트 내역에 기록
        recordPoint(nickname, description, gainedPoints);

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
  }, [nickname, selectedImage, recordPoint])

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
        {/* ⭐️ 태그 오류 수정 완료 및 PC 와이드 UI 적용 */}
        <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto flex flex-col gap-6 mt-8 px-4">
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
    <main className="min-h-screen bg-background relative">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        {/* ⭐️ PC 와이드 UI 적용 */}
        <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            
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

            <div className="flex items-center gap-2">
              
              {/* ⭐️ 클릭 시 포인트 내역 모달 열림 */}
              <button 
                onClick={() => setIsHistoryModalOpen(true)}
                className="flex items-center gap-2 bg-card border border-border rounded-2xl px-3 py-2 hover:bg-secondary transition-colors"
                title="포인트 내역 보기"
              >
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">
                    {nickname?.charAt(0)}
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground">
                  {points}P
                </span>
              </button>

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
      
      {/* ⭐️ PC 와이드 UI 적용 */}
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-4 py-6">
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

      {/* ⭐️ 포인트 내역 모달 */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-3xl shadow-xl flex flex-col max-h-[80vh] border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-border bg-background">
              <h2 className="text-lg font-bold text-foreground">포인트 내역</h2>
              <button 
                onClick={() => setIsHistoryModalOpen(false)} 
                className="p-2 bg-secondary/50 hover:bg-secondary rounded-full transition-colors text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 bg-background">
              {pointHistory.length === 0 ? (
                <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-2">
                  <span className="text-3xl">🫙</span>
                  <p>아직 적립된 포인트가 없습니다.</p>
                </div>
              ) : (
                pointHistory.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl border border-border bg-card">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-foreground">{item.description}</span>
                      <span className="text-xs text-muted-foreground">{item.date}</span>
                    </div>
                    <span className={`font-bold text-lg ${item.amount > 0 ? 'text-primary' : 'text-red-500'}`}>
                      {item.amount > 0 ? '+' : ''}{item.amount}P
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
