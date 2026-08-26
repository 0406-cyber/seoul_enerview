"use client"

import { useState, useCallback, useEffect, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  checkUserExists,
  updateUserPoints,
  getLeaderboardViaApi,
  savePointLog,
  getPointLogs,
  getSystemLogs,
  getAllOrders,
  updateOrderStatus,
  verifyAdminPassword,
  getAdminUsers,
  getAdminUserDetail,
  adjustUserPointsByAdmin,
  getUsageHistory,
  saveCertification,
  getCertifications,
  saveChatMessage, 
  getChatMessages  
} from "@/lib/db"
import { loadUsageHistory, appendUsageLocal, type UsageRecord } from "@/lib/usage-storage"
import { loadPoints, savePoints } from "@/lib/points-storage"
import {
  CAR_PATTERN_OPTIONS,
  DEFAULT_CARBON_CATEGORY_INPUTS,
  EMISSION_FACTORS,
  FLIGHT_COUNT_OPTIONS,
  FLIGHT_PATTERN_OPTIONS,
  PUBLIC_TRANSIT_DISTANCE_OPTIONS,
  PUBLIC_TRANSIT_PATTERN_OPTIONS,
  calculateCarbonBreakdown,
  createUsageCarbonDetails,
  getActiveTransportDetail,
  getActiveTransportDistance,
  normalizeTransportMode,
  restoreCarbonBreakdownFromUsage,
  restoreCarbonCategoryInputsFromUsage,
  type CarbonBreakdown,
  type CarbonCategoryInputValues,
  type UsageCarbonDetails,
} from "@/lib/carbon-categories"
import { AppShell } from "@/components/app/app-shell"
import { AppContainer } from "@/components/app/app-container"
import { AppHeader } from "@/components/app/app-header"
import {
  PointHistoryModal,
  type PointHistoryItem,
} from "@/components/app/point-history-modal"
import { getTabMeta, HIDDEN_USER_TAB_IDS } from "@/lib/tab-meta"

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

interface AdminUserEntry {
  username: string
  loginCount: number
  points: number
  usageCount: number
  lastUsageDate: string | null
  lastCo2Kg: number
  totalCo2Kg: number
  pointLogCount: number
  certificationCount: number
  orderCount: number
  pendingOrderCount: number
}

interface AdminUserDetail {
  user: AdminUserEntry | null
  pointLogs: PointHistoryItem[]
  usageHistory: UsageRecord[]
  certifications: CertificationHistory[]
  orders: Array<{
    id: string
    itemId: string
    itemName: string
    cost: number
    requestedAt: string
    status: string
  }>
}

type DetailedUsageRecord = UsageRecord & Partial<UsageCarbonDetails>

const kg = (value: number | null | undefined, digits = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? `${parsed.toFixed(digits)}kg` : "0.0kg"
}

const kwh = (value: number | null | undefined) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? `${parsed.toFixed(1)}kWh` : "0.0kWh"
}

const cubicMeters = (value: number | null | undefined) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? `${parsed.toFixed(1)}m³` : "0.0m³"
}

const percentOf = (part: number, total: number) => {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return "0%"
  return `${((part / total) * 100).toFixed(1)}%`
}

const optionText = <T extends string | number>(
  options: readonly { value: T; label: string; description?: string }[],
  value: T,
) => {
  const option = options.find((item) => String(item.value) === String(value))
  return option
    ? `${option.label}${option.description ? ` (${option.description})` : ""}`
    : String(value)
}

const summarizeUsageTrend = (history: UsageRecord[]) => {
  const recent = history.slice(-6)
  if (recent.length === 0) return "기록 없음"

  const latest = recent.at(-1)
  const previous = recent.length >= 2 ? recent.at(-2) : null
  const avg = recent.reduce((sum, item) => sum + (Number(item.co2_kg) || 0), 0) / recent.length
  const min = recent.reduce((best, item) =>
    (Number(item.co2_kg) || 0) < (Number(best.co2_kg) || 0) ? item : best,
  recent[0])
  const max = recent.reduce((best, item) =>
    (Number(item.co2_kg) || 0) > (Number(best.co2_kg) || 0) ? item : best,
  recent[0])

  const delta = latest && previous ? (Number(latest.co2_kg) || 0) - (Number(previous.co2_kg) || 0) : 0
  const direction =
    !previous || Math.abs(delta) < 0.01
      ? "변화 거의 없음"
      : delta > 0
        ? `직전 기록 대비 ${kg(delta)} 증가`
        : `직전 기록 대비 ${kg(Math.abs(delta))} 감소`

  return [
    `최근 ${recent.length}개 기록 평균: ${kg(avg)}`,
    `추세: ${direction}`,
    `최저/최고: ${min.date} ${kg(min.co2_kg)} / ${max.date} ${kg(max.co2_kg)}`,
    `최근 기록 목록: ${recent.map((item) => `${item.date}=${kg(item.co2_kg)}`).join(", ")}`,
  ].join("\n")
}

const buildDetailedAdvicePrompt = ({
  nickname,
  latest,
  history,
  inputs,
  breakdown,
  points,
}: {
  nickname: string | null
  latest: DetailedUsageRecord
  history: UsageRecord[]
  inputs: CarbonCategoryInputValues
  breakdown: CarbonBreakdown
  points: number
}) => {
  const totalMonthlyKg = Number(latest.co2_kg) || breakdown.totalMonthlyKg
  const electricityMonthlyKg = (Number(latest.elec_kwh) || 0) * 0.4781
  const gasMonthlyKg = (Number(latest.gas_m3) || 0) * 2.176
  const transportMode = normalizeTransportMode(inputs.publicTransitPattern)
  const publicTransit =
    PUBLIC_TRANSIT_PATTERN_OPTIONS.find((item) => item.value === transportMode) ??
    PUBLIC_TRANSIT_PATTERN_OPTIONS[0]
  const transportDetail = getActiveTransportDetail(transportMode, inputs.carPattern)
  const publicTransitDistance = getActiveTransportDistance(
    transportMode,
    inputs.publicTransitDistance,
  )
  const transportDetailText =
    transportMode === "walkBike" || !transportDetail
      ? "해당 없음"
      : optionText(CAR_PATTERN_OPTIONS, transportDetail.value)
  const transportDistanceText =
    transportMode === "walkBike" || !publicTransitDistance
      ? "해당 없음"
      : optionText(PUBLIC_TRANSIT_DISTANCE_OPTIONS, publicTransitDistance.value)
  const transportDistanceAssumption =
    !publicTransitDistance
      ? "0km"
      : "weeklyKm" in publicTransitDistance
        ? `${publicTransitDistance.weeklyKm}km/주`
        : `${publicTransitDistance.averageKmPerTrip}km/편도`
  const flight = FLIGHT_PATTERN_OPTIONS.find((item) => item.value === inputs.flightPattern) ?? FLIGHT_PATTERN_OPTIONS[0]
  const beefMonthlyKg =
    (Number(inputs.beefMealsPerWeek) || 0) * EMISSION_FACTORS.mealKg.beef * 52 / 12
  const porkMonthlyKg =
    (Number(inputs.porkMealsPerWeek) || 0) * EMISSION_FACTORS.mealKg.pork * 52 / 12
  const chickenMonthlyKg =
    (Number(inputs.chickenMealsPerWeek) || 0) * EMISSION_FACTORS.mealKg.chicken * 52 / 12
  const seafoodMonthlyKg =
    (Number(inputs.seafoodMealsPerWeek) || 0) * EMISSION_FACTORS.mealKg.seafood * 52 / 12
  const plantMonthlyKg =
    (Number(inputs.plantMealsPerWeek) || 0) * EMISSION_FACTORS.mealKg.plant * 52 / 12

  return `
[역할]
너는 에너뷰(Enerview)의 탄소 감축 코치다. 아래 사용자의 실제 입력값을 근거로 우선순위가 분명한 맞춤형 조언을 한국어로 작성해라.

[사용자/기록]
- 사용자: ${nickname ?? "미확인 사용자"}
- 보유 포인트: ${points}P
- 분석 기준일: ${latest.date}
- 월간 총 탄소배출량: ${kg(totalMonthlyKg, 2)}
- 연환산 탄소배출량: ${kg(breakdown.annualKg, 2)}

[월간 카테고리별 배출량]
- 주거: ${kg(breakdown.residentialMonthlyKg, 2)} (${percentOf(breakdown.residentialMonthlyKg, totalMonthlyKg)})
- 교통: ${kg(breakdown.transportMonthlyKg, 2)} (${percentOf(breakdown.transportMonthlyKg, totalMonthlyKg)})
- 식단: ${kg(breakdown.dietMonthlyKg, 2)} (${percentOf(breakdown.dietMonthlyKg, totalMonthlyKg)})

[주거 상세]
- 전기 사용량: ${kwh(latest.elec_kwh)} → 전기 배출량 추정 ${kg(electricityMonthlyKg, 2)}
- 가스 사용량: ${cubicMeters(latest.gas_m3)} → 가스 배출량 추정 ${kg(gasMonthlyKg, 2)}
- 전기 배출계수: 0.4781kgCO₂/kWh
- 가스 배출계수: 2.176kgCO₂/m³

[교통 상세]
- 주간 이동수단: ${optionText(PUBLIC_TRANSIT_PATTERN_OPTIONS, transportMode)}
- 이동수단 세부 선택: ${transportDetailText}
- 이동거리 선택: ${transportDistanceText}
- 이동거리 가정: ${transportMode === "walkBike" ? "0km" : transportDistanceAssumption}
- 대중교통 주간 이동 횟수 가정: ${transportMode === "publicTransit" ? publicTransit.weeklyTrips : 0}회/주
- 차량 연간 배출량: ${kg(breakdown.details.carAnnualKg, 2)}
- 대중교통 연간 배출량: ${kg(breakdown.details.publicTransitAnnualKg, 2)}
- 비행 패턴: ${optionText(FLIGHT_PATTERN_OPTIONS, inputs.flightPattern)}
- 비행 횟수: ${optionText(FLIGHT_COUNT_OPTIONS, inputs.flightTripsPerYear)}
- 선택 비행거리 가정: ${flight.annualKm}km/회
- 비행 연간 배출량: ${kg(breakdown.details.flightAnnualKg, 2)}

[식단 상세: 주간 횟수와 월간 배출량 추정]
- 소고기: ${inputs.beefMealsPerWeek}회/주 → ${kg(beefMonthlyKg, 2)}/월
- 돼지고기: ${inputs.porkMealsPerWeek}회/주 → ${kg(porkMonthlyKg, 2)}/월
- 닭고기: ${inputs.chickenMealsPerWeek}회/주 → ${kg(chickenMonthlyKg, 2)}/월
- 해산물: ${inputs.seafoodMealsPerWeek}회/주 → ${kg(seafoodMonthlyKg, 2)}/월
- 채식/저탄소 식사: ${inputs.plantMealsPerWeek}회/주 → ${kg(plantMonthlyKg, 2)}/월
- 식단 전체 연간 배출량: ${kg(breakdown.details.dietAnnualKg, 2)}

[최근 기록 추세]
${summarizeUsageTrend(history)}

[답변 지시]
1. 가장 큰 배출 카테고리부터 감축 우선순위를 1~3순위로 잡아라.
2. 각 우선순위마다 사용자가 바로 할 수 있는 행동을 2개 이상 제시해라.
3. 위 수치로 계산 가능한 경우 예상 감축량을 kg 단위로 대략 제시하되, 계산 근거가 부족하면 "추정"이라고 표시해라.
4. 사용자가 입력하지 않은 정보는 단정하지 말고, 필요한 추가 질문을 마지막에 1개만 제시해라.
5. 답변은 친절하지만 짧고 실행 중심으로 작성해라.
`.trim()
}

function MainContent() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab") || "analysis"
  const activeTab = HIDDEN_USER_TAB_IDS.some((tab) => tab === requestedTab) ? "analysis" : requestedTab

  const handleTabChange = (newTab: string) => {
    if (HIDDEN_USER_TAB_IDS.some((tab) => tab === newTab)) return
    if (newTab === "carbonMap") {
      window.location.assign("https://co2map-ihrpgoaucbxrzemcuxbicl.streamlit.app/")
      return
    }

    router.push(`?tab=${newTab}`, { scroll: false })
  }

  const resetToAnalysisTab = useCallback(() => {
    router.replace("/", { scroll: false })
  }, [router])

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
        resetToAnalysisTab();
        return;
      }
      setNickname(savedName)
      setIsOnboarded(true)
      setPoints(loadPoints(savedName, 100))
    } else {
      resetToAnalysisTab();
    }
  }, [resetToAnalysisTab])

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
  const [hasLoadedUsage, setHasLoadedUsage] = useState(false)
  const [hasLoadedChats, setHasLoadedChats] = useState(false)
  const [hasLoadedCertifications, setHasLoadedCertifications] = useState(false)
  const [hasLoadedLeaderboard, setHasLoadedLeaderboard] = useState(false)
  const [hasLoadedPointLogs, setHasLoadedPointLogs] = useState(false)

  const [sysLogs, setSysLogs] = useState<any[]>([])
  const [isAdminLogsLoading, setIsAdminLogsLoading] = useState(false)

  const [adminOrders, setAdminOrders] = useState<any[]>([])
  const [isAdminOrdersLoading, setIsAdminOrdersLoading] = useState(false)

  const [adminUsers, setAdminUsers] = useState<AdminUserEntry[]>([])
  const [isAdminUsersLoading, setIsAdminUsersLoading] = useState(false)
  const [adminUserQuery, setAdminUserQuery] = useState("")
  const [selectedAdminUser, setSelectedAdminUser] = useState<string | null>(null)
  const [adminUserDetail, setAdminUserDetail] = useState<AdminUserDetail | null>(null)
  const [isAdminUserDetailLoading, setIsAdminUserDetailLoading] = useState(false)
  const [adminPointTarget, setAdminPointTarget] = useState("")
  const [adminPointAmount, setAdminPointAmount] = useState("100")
  const [adminPointReason, setAdminPointReason] = useState("관리자 수동 조정")
  const [isAdminPointSaving, setIsAdminPointSaving] = useState(false)

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

  const loadUsageFromServer = useCallback(async () => {
    if (!nickname) return [];

    const serverHistory = await getUsageHistory(nickname, 30);

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

    setHasLoadedUsage(true);
    return serverHistory;
  }, [nickname]);

  useEffect(() => {
    if (!nickname || !mounted) return;
    if (activeTab !== "analysis") return;
    if (hasLoadedUsage) return;

    loadUsageFromServer().catch((e: any) => {
      console.error("사용량 조회 실패:", e?.message || e);
    });
  }, [nickname, mounted, activeTab, hasLoadedUsage, loadUsageFromServer]);

  useEffect(() => {
    if (!nickname || !mounted) return;
    if (activeTab !== "coaching") return;
    if (hasLoadedChats) return;

    getChatMessages(nickname, 30)
      .then((chatHistory) => {
        if (chatHistory && chatHistory.length > 0) {
          setMessages(chatHistory);
        }
        setHasLoadedChats(true);
      })
      .catch((e) => console.error("대화 내역 조회 실패:", e));
  }, [nickname, mounted, activeTab, hasLoadedChats]);

  useEffect(() => {
    if (!nickname || !mounted) return;
    if (activeTab !== "certification") return;
    if (hasLoadedCertifications) return;

    getCertifications(nickname, 20)
      .then((serverCerts) => {
        if (serverCerts && serverCerts.length > 0) {
          setCertificationHistory(serverCerts);
        }
        setHasLoadedCertifications(true);
      })
      .catch((e) => console.error("인증 내역 조회 실패:", e));
  }, [nickname, mounted, activeTab, hasLoadedCertifications]);

  useEffect(() => {
    if (!nickname || !mounted) return;
    if (activeTab !== "leaderboard") return;
    if (hasLoadedLeaderboard) return;

    getLeaderboardViaApi(50)
      .then((remoteData) => {
        setRemoteUsers(remoteData);

        const myData = remoteData.find((u) => u.name === nickname);
        if (myData && myData.points >= 0) {
          setPoints(myData.points);
          savePoints(nickname, myData.points);
        }

        setHasLoadedLeaderboard(true);
      })
      .catch((e) => console.error("리더보드 조회 실패:", e));
  }, [nickname, mounted, activeTab, hasLoadedLeaderboard]);

  useEffect(() => {
    if (!nickname) return;
    if (!isHistoryModalOpen) return;
    if (hasLoadedPointLogs) return;

    getPointLogs(nickname, 30)
      .then((logs) => {
        if (logs && logs.length > 0) {
          setPointHistory(logs);
        }
        setHasLoadedPointLogs(true);
      })
      .catch((e) => console.error("포인트 로그 조회 실패:", e));
  }, [nickname, isHistoryModalOpen, hasLoadedPointLogs]);


  useEffect(() => {
    if (!isOnboarded || !nickname || nickname === "admin") return;

    const logKey = `eco_syslog_${nickname}`;
    if (sessionStorage.getItem(logKey)) return;
    sessionStorage.setItem(logKey, "1");

    fetch("/api/syslog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: `접속 (${nickname})` })
    }).catch(() => {
      sessionStorage.removeItem(logKey);
    });
  }, [isOnboarded, nickname]);

  useEffect(() => {
    if (nickname === "admin" && isAdminAuthenticated) {
      setIsAdminLogsLoading(true);
      setIsAdminOrdersLoading(true);
      setIsAdminUsersLoading(true);
      
      Promise.all([getSystemLogs(), getAllOrders(), getAdminUsers(adminPassword)])
        .then(([sysLogsData, ordersData, usersData]) => {
          setSysLogs(sysLogsData);
          setAdminOrders(ordersData);
          setAdminUsers(usersData);
        })
        .catch((e) => {
          console.error("관리자 데이터 로딩 실패:", e);
          toast.error("관리자 데이터를 불러오지 못했습니다.");
        })
        .finally(() => {
          setIsAdminLogsLoading(false);
          setIsAdminOrdersLoading(false);
          setIsAdminUsersLoading(false);
        });
    }
  }, [nickname, isAdminAuthenticated, adminPassword]);

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

  const filteredAdminUsers = useMemo(() => {
    const query = adminUserQuery.trim().toLowerCase();
    if (!query) return adminUsers;
    return adminUsers.filter((user) => user.username.toLowerCase().includes(query));
  }, [adminUserQuery, adminUsers]);

  const adminSummary = useMemo(() => {
    const visibleUsers = adminUsers.filter((user) => user.username !== "admin");
    return {
      userCount: visibleUsers.length,
      totalPoints: visibleUsers.reduce((sum, user) => sum + user.points, 0),
      totalUsageCount: visibleUsers.reduce((sum, user) => sum + user.usageCount, 0),
      pendingOrders: adminOrders.filter((order) => order.status === "requested").length,
    };
  }, [adminUsers, adminOrders]);

  const refreshAdminUsers = useCallback(async () => {
    setIsAdminUsersLoading(true);
    try {
      const usersData = await getAdminUsers(adminPassword);
      setAdminUsers(usersData);
      return usersData;
    } catch (e) {
      console.error("사용자 목록 새로고침 실패:", e);
      toast.error("사용자 목록을 불러오지 못했습니다.");
      return [];
    } finally {
      setIsAdminUsersLoading(false);
    }
  }, [adminPassword]);

  const handleSelectAdminUser = useCallback(async (userName: string) => {
    setSelectedAdminUser(userName);
    setAdminPointTarget(userName);
    setIsAdminUserDetailLoading(true);
    try {
      const detail = await getAdminUserDetail(userName, adminPassword);
      setAdminUserDetail(detail);
    } catch (e) {
      console.error("사용자 상세 조회 실패:", e);
      toast.error("사용자 상세 정보를 불러오지 못했습니다.");
    } finally {
      setIsAdminUserDetailLoading(false);
    }
  }, [adminPassword]);

  const handleAdminPointAdjust = useCallback(async (mode: "grant" | "revoke") => {
    const target = adminPointTarget.trim();
    const parsedAmount = Math.abs(Number.parseInt(adminPointAmount, 10));

    if (!target) {
      toast.error("대상 사용자를 선택하거나 입력해 주세요.");
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("포인트는 1 이상의 숫자로 입력해 주세요.");
      return;
    }

    const signedAmount = mode === "grant" ? parsedAmount : -parsedAmount;
    const reason = adminPointReason.trim() || (mode === "grant" ? "관리자 포인트 지급" : "관리자 포인트 회수");

    setIsAdminPointSaving(true);
    try {
      const updated = await adjustUserPointsByAdmin(target, signedAmount, reason, adminPassword);
      const usersData = await getAdminUsers(adminPassword);
      setAdminUsers(usersData);
      setAdminPointTarget(updated.username);
      setSelectedAdminUser(updated.username);
      const detail = await getAdminUserDetail(updated.username, adminPassword);
      setAdminUserDetail(detail);
      toast.success(`${updated.username}님 포인트가 ${updated.points.toLocaleString()}P로 조정되었습니다.`);
    } catch (e: any) {
      console.error("관리자 포인트 조정 실패:", e);
      toast.error(e?.message || "포인트 조정에 실패했습니다.");
    } finally {
      setIsAdminPointSaving(false);
    }
  }, [adminPointTarget, adminPointAmount, adminPointReason, adminPassword]);
     
  const handleOnboardingComplete = useCallback(async (name: string) => {
    resetToAnalysisTab();
    localStorage.setItem("eco_nickname", name);
    sessionStorage.setItem("eco_session", "active");
    setNickname(name);
    setIsOnboarded(true);
    setHasLoadedUsage(false);
    setHasLoadedChats(false);
    setHasLoadedCertifications(false);
    setHasLoadedLeaderboard(false);
    setHasLoadedPointLogs(false);
  
    try {
      const user = await loginUser(name);

      setPoints(user.points);
      savePoints(name, user.points);

      if (user.isNew) {
        recordPoint(name, "신규 가입 보너스", 100);
        toast.success("가입을 축하합니다!");
      } else {
        toast.success(`${name}님, 다시 오신 것을 환영합니다!`);
      }
    } catch (e: any) {
      console.error("로그인 동기화 에러:", e.message);
      setPoints(loadPoints(name, 100)); 
    }
  }, [recordPoint, resetToAnalysisTab]);

  const checkIsExistingUser = useCallback(async (name: string) => {
    try {
      return await checkUserExists(name);
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

  const handleAdminLogin = useCallback(async () => {
    try {
      await verifyAdminPassword(adminPassword);
      setIsAdminAuthenticated(true)
      toast.success("관리자 인증 성공! 대시보드를 불러옵니다.")
    } catch {
      toast.error("비밀번호가 일치하지 않습니다.")
    }
  }, [adminPassword])

  const handleAdminLogout = useCallback(() => {
    resetToAnalysisTab()
    setIsAdminAuthenticated(false)
    setNickname(null)
    setIsOnboarded(false)
    setAdminPassword("")
    localStorage.removeItem("eco_nickname")
    sessionStorage.removeItem("eco_session")
  }, [resetToAnalysisTab])

  const handleLogout = useCallback(() => {
    resetToAnalysisTab();
    localStorage.removeItem("eco_nickname");
    sessionStorage.removeItem("eco_session");
    setNickname(null);
    setIsOnboarded(false);
    setIsAdminAuthenticated(false);
    setAdminPassword("");
    setCarbonBreakdown(null);
    setCarbonCategoryInputs(DEFAULT_CARBON_CATEGORY_INPUTS);
    setUsageHistory([]);
    setMessages([]);
    setCertificationHistory([]);
    setPointHistory([]);
    setRemoteUsers([]);
    setHasLoadedUsage(false);
    setHasLoadedChats(false);
    setHasLoadedCertifications(false);
    setHasLoadedLeaderboard(false);
    setHasLoadedPointLogs(false);
    toast.success("로그아웃 되었습니다.");
  }, [resetToAnalysisTab]);

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

  const handleSendMessage = useCallback(async (content: string, nicknameFromTab?: string) => {
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

    const effectiveNickname = nicknameFromTab?.trim() || nickname?.trim() || "";

    if (effectiveNickname) {
      saveChatMessage(effectiveNickname, "user", content, userMessageId).catch(console.error);
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: content,
          history: historyForApi,
          nickname: effectiveNickname,
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

      if (effectiveNickname) {
        saveChatMessage(effectiveNickname, "assistant", fullAssistantMessage, assistantMessageId).catch(console.error);
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
        let historyForAdvice = usageHistory;

        if (historyForAdvice.length === 0 && nickname) {
          historyForAdvice = await loadUsageFromServer();
        }

        if (historyForAdvice.length === 0) {
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

        const latest = historyForAdvice[historyForAdvice.length - 1] as DetailedUsageRecord;
        const latestInputs = restoreCarbonCategoryInputsFromUsage(latest) ?? carbonCategoryInputs;
        const latestBreakdown =
          carbonBreakdown ??
          restoreCarbonBreakdownFromUsage(latest) ??
          calculateCarbonBreakdown(
            (Number(latest.elec_kwh) || 0) * 0.4781 + (Number(latest.gas_m3) || 0) * 2.176,
            latestInputs,
          );
        const prompt = buildDetailedAdvicePrompt({
          nickname,
          latest,
          history: historyForAdvice,
          inputs: latestInputs,
          breakdown: latestBreakdown,
          points,
        });

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
            history: [],
            nickname: nickname?.trim() || "",
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
    }, [usageHistory, nickname, carbonBreakdown, carbonCategoryInputs, points, loadUsageFromServer]);

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
            
            <div className="bg-card p-6 rounded-2xl border border-border flex flex-col gap-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">👥 사용자 · 포인트 관리</h2>
                  <p className="text-sm text-muted-foreground mt-1">사용자 조회, 상세 활동 확인, 포인트 지급/회수를 한 화면에서 처리합니다.</p>
                </div>
                <button
                  onClick={refreshAdminUsers}
                  disabled={isAdminUsersLoading}
                  className="text-sm bg-secondary text-secondary-foreground px-4 py-2 rounded-xl font-medium hover:bg-secondary/80 transition disabled:opacity-50"
                >
                  {isAdminUsersLoading ? "새로고침 중..." : "사용자 새로고침"}
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-background p-4 rounded-xl border border-border">
                  <div className="text-xs text-muted-foreground">사용자</div>
                  <div className="text-xl font-bold text-foreground mt-1">{adminSummary.userCount.toLocaleString()}명</div>
                </div>
                <div className="bg-background p-4 rounded-xl border border-border">
                  <div className="text-xs text-muted-foreground">총 포인트</div>
                  <div className="text-xl font-bold text-primary mt-1">{adminSummary.totalPoints.toLocaleString()}P</div>
                </div>
                <div className="bg-background p-4 rounded-xl border border-border">
                  <div className="text-xs text-muted-foreground">탄소 기록</div>
                  <div className="text-xl font-bold text-foreground mt-1">{adminSummary.totalUsageCount.toLocaleString()}건</div>
                </div>
                <div className="bg-background p-4 rounded-xl border border-border">
                  <div className="text-xs text-muted-foreground">대기 주문</div>
                  <div className="text-xl font-bold text-yellow-500 mt-1">{adminSummary.pendingOrders.toLocaleString()}건</div>
                </div>
              </div>

              <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
                <div className="bg-background rounded-xl border border-border overflow-hidden">
                  <div className="p-4 border-b border-border flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <input
                      value={adminUserQuery}
                      onChange={(e) => setAdminUserQuery(e.target.value)}
                      placeholder="사용자명 검색"
                      className="bg-card text-foreground border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full md:max-w-xs"
                    />
                    <span className="text-xs text-muted-foreground">표시 {filteredAdminUsers.length.toLocaleString()}명</span>
                  </div>

                  {isAdminUsersLoading ? (
                    <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">사용자 정보를 불러오는 중입니다...</div>
                  ) : filteredAdminUsers.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">검색된 사용자가 없습니다.</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[430px] overflow-y-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground bg-secondary/50 sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="px-4 py-3 font-medium whitespace-nowrap">사용자</th>
                            <th className="px-4 py-3 font-medium text-right whitespace-nowrap">포인트</th>
                            <th className="px-4 py-3 font-medium text-right whitespace-nowrap">로그인</th>
                            <th className="px-4 py-3 font-medium text-right whitespace-nowrap">탄소 기록</th>
                            <th className="px-4 py-3 font-medium whitespace-nowrap">최근 기록</th>
                            <th className="px-4 py-3 font-medium text-center whitespace-nowrap">액션</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredAdminUsers.slice(0, 200).map((user) => (
                            <tr key={user.username} className={selectedAdminUser === user.username ? "bg-primary/5" : "hover:bg-secondary/20 transition-colors"}>
                              <td className="px-4 py-3 font-medium whitespace-nowrap">{user.username}</td>
                              <td className="px-4 py-3 text-right font-bold text-primary whitespace-nowrap">{user.points.toLocaleString()}P</td>
                              <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">{user.loginCount.toLocaleString()}회</td>
                              <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">{user.usageCount.toLocaleString()}건</td>
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{user.lastUsageDate || "-"}</td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <button
                                  onClick={() => handleSelectAdminUser(user.username)}
                                  className="px-3 py-1 bg-secondary text-secondary-foreground text-xs rounded-lg hover:bg-secondary/80 transition"
                                >
                                  상세/선택
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <div className="bg-background p-4 rounded-xl border border-border flex flex-col gap-3">
                    <h3 className="font-bold text-foreground">포인트 지급/회수</h3>
                    <input
                      value={adminPointTarget}
                      onChange={(e) => setAdminPointTarget(e.target.value)}
                      placeholder="대상 사용자명"
                      className="bg-card text-foreground border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      type="number"
                      min="1"
                      value={adminPointAmount}
                      onChange={(e) => setAdminPointAmount(e.target.value)}
                      placeholder="포인트 수량"
                      className="bg-card text-foreground border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      value={adminPointReason}
                      onChange={(e) => setAdminPointReason(e.target.value)}
                      placeholder="사유"
                      className="bg-card text-foreground border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleAdminPointAdjust("grant")}
                        disabled={isAdminPointSaving}
                        className="bg-green-500 text-white font-bold rounded-xl p-3 hover:bg-green-600 transition disabled:opacity-50"
                      >
                        지급
                      </button>
                      <button
                        onClick={() => handleAdminPointAdjust("revoke")}
                        disabled={isAdminPointSaving}
                        className="bg-red-500 text-white font-bold rounded-xl p-3 hover:bg-red-600 transition disabled:opacity-50"
                      >
                        회수
                      </button>
                    </div>
                  </div>

                  <div className="bg-background p-4 rounded-xl border border-border min-h-[220px]">
                    <h3 className="font-bold text-foreground mb-3">선택 사용자 상세</h3>
                    {isAdminUserDetailLoading ? (
                      <div className="text-sm text-muted-foreground animate-pulse">상세 정보를 불러오는 중입니다...</div>
                    ) : !adminUserDetail?.user ? (
                      <div className="text-sm text-muted-foreground">사용자를 선택하면 활동 요약과 최근 포인트 내역이 표시됩니다.</div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-card p-3 rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">현재 포인트</div>
                            <div className="font-bold text-primary mt-1">{adminUserDetail.user.points.toLocaleString()}P</div>
                          </div>
                          <div className="bg-card p-3 rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">누적 배출량</div>
                            <div className="font-bold text-foreground mt-1">{adminUserDetail.user.totalCo2Kg.toLocaleString()}kg</div>
                          </div>
                          <div className="bg-card p-3 rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">인증</div>
                            <div className="font-bold text-foreground mt-1">{adminUserDetail.user.certificationCount.toLocaleString()}건</div>
                          </div>
                          <div className="bg-card p-3 rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">주문</div>
                            <div className="font-bold text-foreground mt-1">{adminUserDetail.user.orderCount.toLocaleString()}건</div>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-2">최근 포인트 내역</div>
                          <div className="max-h-[150px] overflow-y-auto divide-y divide-border rounded-lg border border-border">
                            {adminUserDetail.pointLogs.length === 0 ? (
                              <div className="p-3 text-xs text-muted-foreground">포인트 내역이 없습니다.</div>
                            ) : adminUserDetail.pointLogs.slice(0, 8).map((log) => (
                              <div key={log.id} className="p-3 text-xs flex justify-between gap-3">
                                <div>
                                  <div className="font-medium text-foreground">{log.description}</div>
                                  <div className="text-muted-foreground mt-1">{log.date}</div>
                                </div>
                                <div className={log.amount >= 0 ? "font-bold text-green-500 whitespace-nowrap" : "font-bold text-red-500 whitespace-nowrap"}>
                                  {log.amount >= 0 ? "+" : ""}{log.amount.toLocaleString()}P
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
            currentNickname={nickname}
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