"use client"

import { useState, useCallback, useEffect, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Moon, Sun } from "lucide-react"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { BottomNav } from "@/components/bottom-nav"
import { AnalysisTab } from "@/components/tabs/analysis-tab"
import { CoachingTab } from "@/components/tabs/coaching-tab"
import { CertificationTab } from "@/components/tabs/certification-tab"
import { WaterFootprintTab } from "@/components/tabs/water-footprint-tab"
import { CampaignTab } from "@/components/tabs/campaign-tab"
import { EcoCityTab } from "@/components/tabs/eco-city-tab"
import { ShopTab } from "@/components/tabs/shop-tab"
import { CitizenFeedTab } from "@/components/tabs/citizen-feed-tab"
import { LeaderboardTab } from "@/components/tabs/leaderboard-tab"
import { OnboardingScreen } from "@/components/onboarding-screen"
import {
  computeCo2Kg,
  saveUsage,
  loginUser,
  updateUserPoints,
  getLeaderboardViaApi,
  savePointLog,
  getPointLogs,
  getSystemLogs,
  getAllOrders,
  updateOrderStatus,
  getUsageHistory,
  saveCertification,
  getCertifications,
  saveChatMessage, 
  getChatMessages  
} from "@/lib/db"
import { loadUsageHistory, appendUsageLocal, type UsageRecord } from "@/lib/usage-storage"
import { loadPoints, savePoints } from "@/lib/points-storage"
import {
  DEFAULT_CARBON_CATEGORY_INPUTS,
  calculateCarbonBreakdown,
  createUsageCarbonDetails,
  restoreCarbonBreakdownFromUsage,
  restoreCarbonCategoryInputsFromUsage,
  type CarbonBreakdown,
  type CarbonCategoryInputValues,
} from "@/lib/carbon-categories"
import { AppShell } from "@/components/app/app-shell"
import { AppContainer } from "@/components/app/app-container"
import { AppHeader } from "@/components/app/app-header"
import {
  PointHistoryModal,
  type PointHistoryItem,
} from "@/components/app/point-history-modal"
import { getTabMeta } from "@/lib/tab-meta"

const CarbonMapTab = dynamic(
  () => import("@/components/tabs/carbon-map-tab").then((mod) => mod.CarbonMapTab),
  { 
    ssr: false, 
    loading: () => <div className="h-[600px] w-full bg-secondary/30 animate-pulse rounded-[32px] flex items-center justify-center text-muted-foreground font-bold">지도를 불러오는 중입니다...</div> 
  }
);

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

function MainContent() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get("tab") || "analysis"

  const handleTabChange = (newTab: string) => {
    router.push(`?tab=${newTab}`, { scroll: false })
  }

  const [nickname, setNickname] = useState<string | null>(null)
  const [isOnboarded, setIsOnboarded] = useState<boolean>(false)
  const [points, setPoints] = useState<number>(100)

  useEffect(() => {
    setMounted(true)
    const savedName = localStorage.getItem("eco_nickname");
    if (savedName) {
      const sessionFlag = sessionStorage.getItem("eco_session");
      if (!sessionFlag) {
        localStorage.removeItem("eco_nickname");
        return;
      }
      setNickname(savedName)
      setIsOnboarded(true)
      setPoints(loadPoints(savedName, 100))
    }
  }, [])

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  
  const [remoteUsers, setRemoteUsers] = useState<Omit<LeaderboardEntry, "rank">[]>([])
  const [electricityUsage, setElectricityUsage] = useState("")
  const [gasUsage, setGasUsage] = useState("")
  const [carbonEmission, setCarbonEmission] = useState<number | null>(null)
  const [carbonBreakdown, setCarbonBreakdown] = useState<CarbonBreakdown | null>(null)
  const [carbonCategoryInputs, setCarbonCategoryInputs] = useState<CarbonCategoryInputValues>(DEFAULT_CARBON_CATEGORY_INPUTS)
  const [usageHistory, setUsageHistory] = useState<UsageRecord[]>([])
  const [isSavingUsage, setIsSavingUsage] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [isCoachingLoading, setIsCoachingLoading] = useState(false)

  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [certificationHistory, setCertificationHistory] = useState<CertificationHistory[]>([])

  const [pointHistory, setPointHistory] = useState<PointHistoryItem[]>([])
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  const [sysLogs, setSysLogs] = useState<any[]>([])
  const [isAdminLogsLoading, setIsAdminLogsLoading] = useState(false)

  const [adminOrders, setAdminOrders] = useState<any[]>([])
  const [isAdminOrdersLoading, setIsAdminOrdersLoading] = useState(false)

  const recordPoint = useCallback(async (userName: string, desc: string, amt: number) => {
    setPointHistory(prev => {
      const newItem: PointHistoryItem = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString("ko-KR") + " " + new Date().toLocaleTimeString("ko-KR", {hour: "2-digit", minute: "2-digit"}),
        description: desc,
        amount: amt
      };
      return [newItem, ...prev];
    });

    try {
      await savePointLog(userName, desc, amt);
    } catch (e) {
      console.error("포인트 로그 D1 저장 실패:", e);
    }
  }, []);

  useEffect(() => {
    if (!nickname || !mounted) return;

    const syncWithServer = async () => {
      try {
        const serverHistory = await getUsageHistory(nickname);
        if (serverHistory && serverHistory.length > 0) {
          setUsageHistory(serverHistory);
          const last = serverHistory[serverHistory.length - 1];
          setCarbonEmission(last.co2_kg);
          setElectricityUsage(String(last.elec_kwh));
          setGasUsage(String(last.gas_m3));

          const restoredInputs = restoreCarbonCategoryInputsFromUsage(last);
          if (restoredInputs) {
            setCarbonCategoryInputs(restoredInputs);
          }

          const restoredBreakdown = restoreCarbonBreakdownFromUsage(last);
          if (restoredBreakdown) {
            setCarbonBreakdown(restoredBreakdown);
          }
        } else {
          const localHistory = loadUsageHistory(nickname);
          setUsageHistory(localHistory);

          const last = localHistory.at(-1);
          if (last) {
            const restoredInputs = restoreCarbonCategoryInputsFromUsage(last);
            const restoredBreakdown = restoreCarbonBreakdownFromUsage(last);
            if (restoredInputs) setCarbonCategoryInputs(restoredInputs);
            if (restoredBreakdown) setCarbonBreakdown(restoredBreakdown);
          }
        }

        const remoteData = await getLeaderboardViaApi();
        setRemoteUsers(remoteData);
        
        const myData = remoteData.find((u) => u.name === nickname);
        if (myData && myData.points >= 0) {
          setPoints(myData.points);
          savePoints(nickname, myData.points); 
        }

        const serverLogs = await getPointLogs(nickname);
        if (serverLogs && serverLogs.length > 0) {
          setPointHistory(serverLogs);
        }

        try {
          const serverCerts = await getCertifications(nickname);
          if (serverCerts && serverCerts.length > 0) {
            setCertificationHistory(serverCerts);
          }
        } catch (certError) {
          console.error("인증 내역을 불러오는 데 실패했습니다:", certError);
        }

        try {
          const chatHistory = await getChatMessages(nickname);
          if (chatHistory && chatHistory.length > 0) {
            setMessages(chatHistory);
          }
        } catch (chatError) {
          console.error("대화 내역을 불러오는 데 실패했습니다:", chatError);
        }

      } catch (e: any) {
        console.error("서버 데이터 동기화 에러:", e.message);
      }
    };
    
    syncWithServer();
  }, [nickname, mounted]);


  useEffect(() => {
    if (isOnboarded && nickname && nickname !== "admin") {
      fetch("/api/syslog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: `접속 (${nickname})` })
      }).catch(() => {});
    }
  }, [isOnboarded, nickname]);

  useEffect(() => {
    if (nickname === "admin" && isAdminAuthenticated) {
      setIsAdminLogsLoading(true);
      
      Promise.all([getSystemLogs(), getAllOrders()])
        .then(([sysLogsData, ordersData]) => {
          setSysLogs(sysLogsData);
          setAdminOrders(ordersData);
          setIsAdminLogsLoading(false);
        })
        .catch((e) => {
          console.error("로그 로딩 실패:", e);
          setIsAdminLogsLoading(false);
        });
    }
  }, [nickname, isAdminAuthenticated]);

  useEffect(() => {
    if (nickname) {
      savePoints(nickname, points);
    }
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
    sessionStorage.setItem("eco_session", "active");
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
        recordPoint(name, "신규 가입 보너스", 100);
        toast.success("가입을 축하합니다! .");
      }
      
      await loginUser(name);
    } catch (e: any) {
      console.error("로그인 동기화 에러:", e.message);
      setPoints(loadPoints(name, 100)); 
    }
  }, [recordPoint]);

  const checkIsExistingUser = useCallback(async (name: string) => {
    try {
      const remoteData = await getLeaderboardViaApi();
      return remoteData.some(u => u.name === name);
    } catch (e) {
      return false;
    }
  }, []);

  const grantPoints = useCallback(
    async (delta: number, reason: string) => {
      if (!nickname) return
      setPoints((p) => p + delta)
      recordPoint(nickname, reason, delta)
      try {
        await updateUserPoints(nickname, delta)
      } catch {
      }
    },
    [nickname, recordPoint]
  )

  const spendPoints = useCallback(
    async (cost: number, reason: string) => {
      if (!nickname) return
      setPoints((p) => {
        if (p < cost) throw new Error("포인트가 부족합니다.")
        return p - cost
      })
      recordPoint(nickname, reason, -cost)
      try {
        await updateUserPoints(nickname, -cost)
      } catch {
      }
    },
    [nickname, recordPoint]
  )

  const handleAdminLogin = useCallback(() => {
    if (adminPassword === process.env.NEXT_PUBLIC_ADMIN_PASSWORD || adminPassword === "seoul1234") {
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
    sessionStorage.removeItem("eco_session")
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem("eco_nickname");
    sessionStorage.removeItem("eco_session");
    setNickname(null);
    setIsOnboarded(false);
    setIsAdminAuthenticated(false);
    setAdminPassword("");
    setCarbonBreakdown(null);
    setCarbonCategoryInputs(DEFAULT_CARBON_CATEGORY_INPUTS);
    toast.success("로그아웃 되었습니다.");
  }, []);

  const handleCarbonCategoryInputChange = useCallback(
    (key: keyof CarbonCategoryInputValues, value: string | number) => {
      setCarbonCategoryInputs((prev) => ({
        ...prev,
        [key]: typeof value === "number" ? Math.max(0, value) : value,
      }) as CarbonCategoryInputValues);
      setCarbonBreakdown(null);
    },
    []
  );

  const handleCalculate = useCallback(async () => {
    if (!nickname) {
      toast.error("닉네임이 없습니다. 온보딩을 다시 진행해 주세요.")
      return
    }

    setIsSavingUsage(true);
    
    try {
      const electricity = parseFloat(electricityUsage) || 0
      const gas = parseFloat(gasUsage) || 0
      
      const residentialEmission = await computeCo2Kg(electricity, gas)
      const breakdown = calculateCarbonBreakdown(residentialEmission, carbonCategoryInputs)
      const emission = breakdown.totalMonthlyKg

      const details = createUsageCarbonDetails(carbonCategoryInputs, breakdown)
      const row: UsageRecord = {
        date: new Date().toISOString().slice(0, 10),
        elec_kwh: electricity,
        gas_m3: gas,
        co2_kg: emission,
        ...details,
      }

      await saveUsage(nickname, electricity, gas, emission, details)

      setCarbonBreakdown(breakdown)
      setCarbonEmission(emission)
      const next = appendUsageLocal(nickname, row)
      setUsageHistory(next)

      toast.success("데이터가 성공적으로 기록되었습니다!");
      
    } catch (e: any) {
      console.error("계산/저장 에러:", e.message);
      toast.error("서버 처리 중 에러가 발생했습니다: " + e.message);
    } finally {
      setIsSavingUsage(false)
    }
  }, [nickname, electricityUsage, gasUsage, carbonCategoryInputs])

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessageId = Date.now().toString();
    const userMessage: Message = {
      id: userMessageId,
      role: "user",
      content,
    };
    
    const assistantMessageId = (Date.now() + 1).toString();
    
    const historyForApi = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: msg.content }],
    }));

    setMessages((prev) => [
      ...prev, 
      userMessage, 
      { id: assistantMessageId, role: "assistant", content: "" }
    ]);
    setIsCoachingLoading(true);

    if (nickname) {
      saveChatMessage(nickname, "user", content, userMessageId).catch(console.error);
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: content,
          history: historyForApi
        }),
      });

      if (!res.body) throw new Error("응답 본문이 없습니다.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let fullAssistantMessage = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          fullAssistantMessage += chunk;
          
          setMessages((prev) => 
            prev.map((msg) => 
              msg.id === assistantMessageId 
                ? { ...msg, content: msg.content + chunk } 
                : msg
            )
          );
        }
      }

      if (nickname) {
        saveChatMessage(nickname, "assistant", fullAssistantMessage, assistantMessageId).catch(console.error);
      }

    } catch (e: any) {
      toast.error("AI 응답 실패: " + e.message);
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === assistantMessageId 
            ? { ...msg, content: "⚠️ 통신 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." } 
            : msg
        )
      );
    } finally {
      setIsCoachingLoading(false);
    }
  }, [messages, nickname]);

  const handleRequestAdvice = useCallback(async () => {
      setIsCoachingLoading(true);
      try {
        if (usageHistory.length === 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: "먼저 '에너지 사용 분석' 탭에서 데이터를 기록해주세요.",
            },
          ]);
          setIsCoachingLoading(false);
          return;
        }

        const latest = usageHistory[usageHistory.length - 1];
        const categorySummary = carbonBreakdown
          ? `교통 ${carbonBreakdown.transportMonthlyKg.toFixed(2)}kg, 식단 ${carbonBreakdown.dietMonthlyKg.toFixed(2)}kg, 주거 ${carbonBreakdown.residentialMonthlyKg.toFixed(2)}kg`
          : "세부 카테고리 정보 없음";
        const prompt = `사용자가 이번 달 기준으로 총 ${latest.co2_kg.toFixed(2)}kg의 탄소를 배출했어. 세부 정보는 ${categorySummary}이야. 전기 ${latest.elec_kwh}kWh, 가스 ${latest.gas_m3}m3도 입력되어 있어. 교통, 식단, 주거 중 감축 여지가 큰 항목을 우선순위로 잡아 실생활에서 실천할 수 있는 팁을 친절하게 한국어로 조언해줘.`;

        const userMessageId = Date.now().toString();
        if (nickname) {
           saveChatMessage(nickname, "user", "[시스템: 사용량 기반 조언 요청]", userMessageId).catch(console.error);
        }

        const assistantMessageId = (Date.now() + 1).toString();
        
        setMessages((prev) => [
          ...prev,
          { id: assistantMessageId, role: "assistant", content: "" }
        ]);

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            message: prompt,
            history: [] 
          }),
        });

        if (!res.body) throw new Error("응답 본문이 없습니다.");

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        let fullAssistantMessage = "";

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            fullAssistantMessage += chunk;
            
            setMessages((prev) => 
              prev.map((msg) => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: msg.content + chunk } 
                  : msg
              )
            );
          }
        }

        if (nickname) {
          saveChatMessage(nickname, "assistant", fullAssistantMessage, assistantMessageId).catch(console.error);
        }

      } catch (e: any) {
        toast.error("조언 요청 실패: " + e.message);
      } finally {
        setIsCoachingLoading(false);
      }
    }, [usageHistory, nickname, carbonBreakdown]);

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
      // 🚀 [수정 완료] 브라우저 환경에서 직접 인프라 변수를 참조하여 튕기던 기존 호출을 서버 라우트('/api/analyze') 호출로 안전하게 우회 처리합니다.
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: selectedImage }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || "이미지 분석에 실패했습니다.";
        toast.error(errMsg);
        return { ok: false, error: errMsg };
      }

      const { result } = await res.json();
      if (!result) {
        toast.error("이미지 분석 결과를 받지 못했습니다.");
        return { ok: false, error: "no_result" };
      }

      if (String(result.action_found).toLowerCase() !== "true") {
        toast.warning(
          "AI 가 사진에서 명확한 에너지 절약 행동을 인식하지 못했습니다."
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
        recordPoint(nickname, description, gainedPoints);

        const newId = Date.now().toString()
        const newDate = new Date().toLocaleDateString("ko-KR").replace(/\. /g, ".").slice(0, -1)

        const newCert = {
          id: newId,
          date: newDate,
          type: description,
          points: gainedPoints,
        }

        setCertificationHistory((prev) => [newCert, ...prev])

        try {
          await saveCertification(nickname, newDate, description, gainedPoints, newId);
        } catch (saveError) {
          console.error("인증 내역 D1 저장 실패:", saveError);
        }

        return { ok: true, earnedPoints: gainedPoints }
      } catch (e: any) {
        console.error("포인트 업데이트 에러:", e.message);
        toast.error("서버와 동기화하는 중 문제가 발생했습니다.");
        return { ok: false, error: "sync_failed" }
      }

    } catch (e: any) {
      toast.error(e.message)
      return { ok: false, error: e.message }
    }
  }, [nickname, selectedImage, recordPoint])

  const tabMeta = getTabMeta(activeTab)

  if (!mounted) return null;

  if (!isOnboarded) {
    return <OnboardingScreen 
      onComplete={handleOnboardingComplete} 
      checkIsExistingUser={checkIsExistingUser}
    />
  }

  if (nickname === "admin") {
    if (!isAdminAuthenticated) {
      return (
        <AppShell>
          <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <div className="bg-card p-8 rounded-2xl border border-border w-full max-sm flex flex-col gap-6 shadow-lg">
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
                onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
              />
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleAdminLogin}
                  className="bg-primary text-primary-foreground font-bold rounded-xl p-3 hover:bg-primary/90 transition w-full"
                >
                  인증하기
                </button>
                <button
                  onClick={handleLogout}
                  className="bg-secondary text-secondary-foreground font-bold rounded-xl p-3 hover:bg-secondary/80 transition w-full"
                >
                  이전으로 돌아가기
                </button>
              </div>
            </div>
          </div>
        </AppShell>
      )
    }

    return (
      <AppShell>
        <AppContainer className="pt-8 pb-12">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-foreground">🛠️ 통합 관리자 대시보드</h1>
              <div className="flex gap-2">
                <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="p-2 bg-secondary rounded-xl">
                  {theme === "dark" ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
                </button>
                <button onClick={handleAdminLogout} className="text-sm bg-secondary text-secondary-foreground px-4 py-2 rounded-xl font-medium hover:bg-secondary/80 transition-colors">로그아웃</button>
              </div>
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

            <div className="bg-card p-6 rounded-2xl border border-border flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">🌐 시스템 접근 및 보안 로그</h2>
                <span className="text-xs font-medium bg-blue-500/10 text-blue-500 px-2 py-1 rounded-md">Cloudflare Edge Logs</span>
              </div>
              
              <div className="bg-background rounded-xl border border-border overflow-hidden">
                {isAdminLogsLoading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
                    네트워크 로그를 분석 중입니다...
                  </div>
                ) : sysLogs.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    수집된 시스템 로그가 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground bg-secondary/50 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">시간</th>
                          <th className="px-4 py-3 font-medium">활동</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">접속 IP</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">국가</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap text-right">디바이스</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-mono">
                        {sysLogs.slice(0, 50).map((log) => (
                          <tr key={log.id} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs font-sans">{log.date}</td>
                            <td className="px-4 py-3 font-medium text-xs whitespace-nowrap">
                              <span className="bg-secondary px-2 py-1 rounded text-foreground">{log.action}</span>
                            </td>
                            <td className="px-4 py-3 text-xs tracking-wider">{log.ip}</td>
                            <td className="px-4 py-3 text-xs">
                              {log.country === "KR" ? "🇰🇷 KR" : `🌍 ${log.country}`}
                            </td>
                            <td className="px-4 py-3 text-xs text-right whitespace-nowrap text-muted-foreground font-sans">
                              {log.device}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card p-6 rounded-2xl border border-border flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">📦 상품 교환 주문 관리</h2>
                <span className="text-xs text-muted-foreground">최근 100건</span>
              </div>
              
              <div className="bg-background rounded-xl border border-border overflow-hidden">
                {isAdminOrdersLoading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
                    주문 데이터를 불러오는 중입니다...
                  </div>
                ) : adminOrders.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    접수된 상품 교환 주문이 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground bg-secondary/50 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">요청 시간</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">사용자</th>
                          <th className="px-4 py-3">상품명</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">포인트</th>
                          <th className="px-4 py-3 text-center whitespace-nowrap">상태</th>
                          <th className="px-4 py-3 text-center whitespace-nowrap">액션</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {adminOrders.slice(0, 100).map((order) => (
                          <tr key={order.id} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">{order.requestedAt}</td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap">{order.username}</td>
                            <td className="px-4 py-3 text-muted-foreground">{order.itemName}</td>
                            <td className="px-4 py-3 text-right font-bold whitespace-nowrap text-primary">
                              {order.cost}P
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                order.status === "fulfilled" ? "bg-green-500/10 text-green-500" :
                                order.status === "cancelled" ? "bg-red-500/10 text-red-500" :
                                "bg-yellow-500/10 text-yellow-500"
                              }`}>
                                {order.status === "fulfilled" ? "완료" :
                                 order.status === "cancelled" ? "취소" : "요청"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              {order.status === "requested" && (
                                <div className="flex gap-1 justify-center">
                                  <button
                                    onClick={async () => {
                                      try {
                                        await updateOrderStatus(order.id, "fulfilled");
                                        setAdminOrders(prev => prev.map(o => 
                                          o.id === order.id ? { ...o, status: "fulfilled" } : o
                                        ));
                                        toast.success("주문이 완료 처리되었습니다.");
                                      } catch (e) {
                                        toast.error("상태 업데이트 실패");
                                      }
                                    }}
                                    className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition"
                                  >
                                    완료
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await updateOrderStatus(order.id, "cancelled");
                                        setAdminOrders(prev => prev.map(o => 
                                          o.id === order.id ? { ...o, status: "cancelled" } : o
                                        ));
                                        toast.success("주문이 취소 처리되었습니다.");
                                      } catch (e) {
                                        toast.error("상태 업데이트 실패");
                                      }
                                    }}
                                    className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition"
                                  >
                                    취소
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </AppContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <AppHeader
        title={tabMeta.title}
        subtitle={tabMeta.subtitle}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        nickname={nickname}
        points={points}
        onOpenPoints={() => setIsHistoryModalOpen(true)}
        onLogout={handleLogout}
      />

      <AppContainer className="py-6">
        {activeTab === "analysis" && (
          <AnalysisTab
            electricityUsage={electricityUsage}
            gasUsage={gasUsage}
            onElectricityChange={setElectricityUsage}
            onGasChange={setGasUsage}
            carbonCategoryInputs={carbonCategoryInputs}
            onCarbonCategoryInputChange={handleCarbonCategoryInputChange}
            onCalculate={handleCalculate}
            carbonEmission={carbonEmission}
            carbonBreakdown={carbonBreakdown}
            chartData={chartData}
            isSaving={isSavingUsage}
          />
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

        {activeTab === "water" && <WaterFootprintTab />}

        {activeTab === "campaign" && (
          <CampaignTab
            nickname={nickname ?? ""}
            points={points}
            onGrantPoints={grantPoints}
          />
        )}

        {activeTab === "ecoCity" && (
          <EcoCityTab
            nickname={nickname ?? ""}
            points={points}
          />
        )}

        {activeTab === "feed" && (
          <CitizenFeedTab
            nickname={nickname ?? ""}
            onAwardPoints={grantPoints}
          />
        )}

        {activeTab === "leaderboard" && (
          <LeaderboardTab
            entries={leaderboard}
            currentUserId="current"
          />
        )}

        {activeTab === "shop" && (
          <ShopTab
            nickname={nickname ?? ""}
            points={points}
            onSpendPoints={spendPoints}
          />
        )}

        {activeTab === "carbonMap" && (
          <CarbonMapTab />
        )}

      </AppContainer>

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      <PointHistoryModal
        open={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        items={pointHistory}
      />
    </AppShell>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MainContent />
    </Suspense>
  )
}