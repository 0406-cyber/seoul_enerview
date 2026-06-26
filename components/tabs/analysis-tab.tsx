"use client";

import {
  useMemo,
  useState,
  useEffect,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  Zap,
  Flame,
  Leaf,
  TrendingDown,
  TrendingUp,
  History,
  Info,
  BarChart3,
  CalendarDays,
  Car,
  Bus,
  Plane,
  Utensils,
  Home,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  calculateCarbonBreakdown,
  PUBLIC_TRANSIT_PATTERN_OPTIONS,
  FLIGHT_PATTERN_OPTIONS,
  FLIGHT_COUNT_OPTIONS,
  EMISSION_FACTORS,
  getDefaultTransportDetailForMode,
  getDefaultTransportDistanceForMode,
  getTransportDetailOptions,
  getTransportDistanceOptions,
  type CarbonBreakdown,
  type CarbonCategoryInputValues,
  type PublicTransitPattern,
} from "@/lib/carbon-categories";

interface AnalysisTabProps {
  electricityUsage: string;
  gasUsage: string;
  onElectricityChange: (value: string) => void;
  onGasChange: (value: string) => void;
  carbonCategoryInputs: CarbonCategoryInputValues;
  onCarbonCategoryInputChange: (
    key: keyof CarbonCategoryInputValues,
    value: string | number,
  ) => void;
  onCalculate: () => Promise<void>;
  carbonEmission: number | null;
  carbonBreakdown: CarbonBreakdown | null;
  chartData: { date: string; carbon: number }[];
  isSaving?: boolean;
}

// 전기요금에서 kWh를 역산하기 위한 계산 함수
const calculateBill = (kwh: number): number => {
  let basic = 0;
  let energy = 0;

  if (kwh <= 200) {
    basic = 730;
    energy = kwh * 105.0;
  } else if (kwh <= 400) {
    basic = 1260;
    energy = 200 * 105.0 + (kwh - 200) * 174.0;
  } else {
    basic = 6060;
    energy = 200 * 105.0 + 200 * 174.0 + (kwh - 400) * 242.3;
  }

  const climate = kwh * 9.0;
  const fuel = kwh * 5.0;

  const pureTotal = basic + energy + climate + fuel;

  // 부가가치세 10% (원 단위 반올림)
  const vat = Math.round(pureTotal * 0.1);

  // 전력산업기반기금 2.7% (10원 미만 절사, 2025.7.1 개정 인하 요율 반영)
  const fund = Math.floor((pureTotal * 0.027) / 10) * 10;

  const total = pureTotal + vat + fund;

  // 최종 청구금액 (10원 단위 미만 절사)
  return Math.floor(total / 10) * 10;
};

const inverseCalculateKwh = (targetBill: number): number => {
  if (targetBill <= 0) return 0;

  let low = 0;
  let high = 50000; // 일반 가정 최대치를 넘어가는 여유 탐색 범위
  let mid = 0;

  // 10원 단위 절사로 인한 계단식 값을 이분 탐색(Binary Search)으로 추적
  for (let i = 0; i < 100; i++) {
    mid = (low + high) / 2;
    const currentBill = calculateBill(mid);

    if (currentBill === targetBill) {
      break;
    } else if (currentBill < targetBill) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Number(mid.toFixed(1));
};

// 도시가스 요금에서 m³를 역산하기 위한 계산 함수
// 도시가스는 지역/공급사/용도/계절별 단가가 달라질 수 있으므로
// 실제 서비스 지역 고지서 기준으로 아래 상수만 조정하면 됩니다.
const GAS_BILL_CONFIG = {
  basicFee: 1000,
  unitPricePerMj: 22.0,
  correctionFactor: 1.0,
  averageCalorificValueMjPerM3: 43.0,
  vatRate: 0.1,
} as const;

const calculateGasBill = (m3: number): number => {
  if (m3 <= 0) return 0;

  const usageMj =
    m3 *
    GAS_BILL_CONFIG.correctionFactor *
    GAS_BILL_CONFIG.averageCalorificValueMjPerM3;
  const usageCharge = usageMj * GAS_BILL_CONFIG.unitPricePerMj;
  const pureTotal = GAS_BILL_CONFIG.basicFee + usageCharge;
  const vat = Math.round(pureTotal * GAS_BILL_CONFIG.vatRate);
  const total = pureTotal + vat;

  // 최종 청구금액 (10원 단위 미만 절사)
  return Math.floor(total / 10) * 10;
};

const inverseCalculateGasM3 = (targetBill: number): number => {
  if (targetBill <= 0) return 0;

  let low = 0;
  let high = 10000; // 일반 가정 최대치를 넘어가는 여유 탐색 범위
  let mid = 0;

  // 10원 단위 절사로 인한 계단식 값을 이분 탐색(Binary Search)으로 추적
  for (let i = 0; i < 100; i++) {
    mid = (low + high) / 2;
    const currentBill = calculateGasBill(mid);

    if (currentBill === targetBill) {
      break;
    } else if (currentBill < targetBill) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Number(mid.toFixed(1));
};

const formatKg = (value: number | null | undefined, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}kg`;
};

const sanitizeMealInput = (value: string): number => {
  if (value === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, 21);
};

function CategoryCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="glass-morphism rounded-[2rem] p-5 md:p-6 space-y-5 border border-border/70">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-black text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

function SelectBlock<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; description: string }[];
  onChange: (value: T) => void;
}) {
  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-muted-foreground ml-1 uppercase tracking-widest">
        {label}
      </label>
      <select
        value={String(value)}
        onChange={(e) => {
          const nextOption = options.find(
            (option) => String(option.value) === e.target.value,
          );
          if (nextOption) onChange(nextOption.value);
        }}
        className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-4 py-4 text-sm font-bold text-foreground border border-black/10 dark:border-white/5 focus:border-primary/50 focus:bg-black/10 dark:focus:bg-white/10 outline-none transition-all"
      >
        {options.map((option) => (
          <option
            key={String(option.value)}
            value={String(option.value)}
            className="bg-white text-zinc-950"
            style={{ backgroundColor: "#ffffff", color: "#111827" }}
          >
            {option.label}
          </option>
        ))}
      </select>
      {selected && (
        <p className="text-[11px] leading-relaxed text-muted-foreground ml-1">
          {selected.description}
        </p>
      )}
    </div>
  );
}

function MealInput({
  label,
  value,
  factor,
  onChange,
}: {
  label: string;
  value: number;
  factor: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground/70">
          {factor}kgCO₂e/kg
        </span>
      </div>
      <div className="relative">
        <input
          type="number"
          min={0}
          max={21}
          step={0.1}
          value={value || ""}
          onChange={(e) => onChange(sanitizeMealInput(e.target.value))}
          placeholder="0"
          className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-4 py-3 pr-16 text-base font-black text-foreground placeholder:text-muted-foreground/50 border border-black/10 dark:border-white/5 focus:border-primary/50 focus:bg-black/10 dark:focus:bg-white/10 outline-none transition-all"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">
          kg/주
        </span>
      </div>
    </label>
  );
}

export function AnalysisTab({
  electricityUsage,
  gasUsage,
  onElectricityChange,
  onGasChange,
  carbonCategoryInputs,
  onCarbonCategoryInputChange,
  onCalculate,
  carbonEmission,
  carbonBreakdown,
  chartData,
  isSaving,
}: AnalysisTabProps) {
  const [isCalculating, setIsCalculating] = useState(false);

  // 입력된 전기요금을 시각적으로 관리하기 위한 로컬 상태
  const [electricityBill, setElectricityBill] = useState(() => {
    return electricityUsage
      ? String(calculateBill(Number(electricityUsage)))
      : "";
  });

  // 입력된 가스요금을 시각적으로 관리하기 위한 로컬 상태
  const [gasBill, setGasBill] = useState(() => {
    return gasUsage ? String(calculateGasBill(Number(gasUsage))) : "";
  });

  // 외부(부모 컴포넌트)에서 초기화되거나 값이 변경될 때 로컬 전기요금 상태를 동기화
  useEffect(() => {
    if (!electricityUsage) {
      setElectricityBill("");
    } else {
      const currentKwh = inverseCalculateKwh(Number(electricityBill));
      // 부모의 kWh가 현재 화면의 요금에서 역산된 kWh와 다르다면 외부에서 덮어씌운 것으로 간주하여 동기화
      if (Number(electricityUsage) !== currentKwh) {
        setElectricityBill(String(calculateBill(Number(electricityUsage))));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [electricityUsage]);

  // 외부(부모 컴포넌트)에서 초기화되거나 값이 변경될 때 로컬 가스요금 상태를 동기화
  useEffect(() => {
    if (!gasUsage) {
      setGasBill("");
    } else {
      const currentM3 = inverseCalculateGasM3(Number(gasBill));
      // 부모의 m³가 현재 화면의 요금에서 역산된 m³와 다르다면 외부에서 덮어씌운 것으로 간주하여 동기화
      if (Number(gasUsage) !== currentM3) {
        setGasBill(String(calculateGasBill(Number(gasUsage))));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gasUsage]);

  const stats = useMemo(() => {
    const last = chartData.at(-1)?.carbon ?? null;
    const prev = chartData.at(-2)?.carbon ?? null;
    const delta = last !== null && prev !== null ? last - prev : null;
    const deltaPct =
      last !== null && prev !== null && prev !== 0
        ? (delta / prev) * 100
        : null;

    const last30 = chartData.slice(Math.max(0, chartData.length - 30));
    const avg30 =
      last30.length > 0
        ? last30.reduce((acc, d) => acc + d.carbon, 0) / last30.length
        : null;

    return { last, prev, delta, deltaPct, avg30, count: chartData.length };
  }, [chartData]);

  const lifestylePreview = useMemo(
    () => calculateCarbonBreakdown(0, carbonCategoryInputs),
    [carbonCategoryInputs],
  );
  const shouldShowTransportDetail =
    carbonCategoryInputs.publicTransitPattern !== "walkBike";
  const transportDetailOptions = useMemo(
    () => getTransportDetailOptions(carbonCategoryInputs.publicTransitPattern),
    [carbonCategoryInputs.publicTransitPattern],
  );
  const transportDistanceOptions = useMemo(
    () => getTransportDistanceOptions(carbonCategoryInputs.publicTransitPattern),
    [carbonCategoryInputs.publicTransitPattern],
  );
  const transportDetailLabel =
    carbonCategoryInputs.publicTransitPattern === "car"
      ? "차량 종류"
      : "대중교통 종류";
  const transportDistanceLabel =
    carbonCategoryInputs.publicTransitPattern === "car"
      ? "주간 이동거리"
      : "편도 이동거리";

  const visibleBreakdown = carbonBreakdown ?? lifestylePreview;
  const hasResidentialInput = Boolean(electricityUsage || gasUsage);
  const hasLifestyleInput =
    lifestylePreview.transportMonthlyKg > 0 ||
    lifestylePreview.dietMonthlyKg > 0;

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      await onCalculate();
    } finally {
      setIsCalculating(false);
    }
  };

  // 요금 입력 시 kWh로 역산하여 전달
  const handleElectricityChange = (e: ChangeEvent<HTMLInputElement>) => {
    const bill = e.target.value;
    setElectricityBill(bill);

    if (!bill || isNaN(Number(bill))) {
      onElectricityChange("");
    } else {
      const kwh = inverseCalculateKwh(Number(bill));
      onElectricityChange(kwh.toString());
    }
  };

  // 요금 입력 시 m³로 역산하여 전달
  const handleGasChange = (e: ChangeEvent<HTMLInputElement>) => {
    const bill = e.target.value;
    setGasBill(bill);

    if (!bill || isNaN(Number(bill))) {
      onGasChange("");
    } else {
      const m3 = inverseCalculateGasM3(Number(bill));
      onGasChange(m3.toString());
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-card rounded-3xl p-4 border border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">최근 배출량</p>
              <p className="text-lg font-black text-foreground truncate">
                {stats.last !== null ? `${stats.last.toFixed(1)}kg` : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-3xl p-4 border border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Bus className="w-4 h-4 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">교통 월환산</p>
              <p className="text-lg font-black text-foreground truncate">
                {formatKg(visibleBreakdown.transportMonthlyKg)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-3xl p-4 border border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-orange-500/10 flex items-center justify-center">
              <Utensils className="w-4 h-4 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">식단 월환산</p>
              <p className="text-lg font-black text-foreground truncate">
                {formatKg(visibleBreakdown.dietMonthlyKg)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-3xl p-4 border border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-secondary flex items-center justify-center">
              <Home className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">주거 월환산</p>
              <p className="text-lg font-black text-foreground truncate">
                {formatKg(carbonBreakdown?.residentialMonthlyKg ?? null)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Main Emission Card */}
        <div className="glass-card rounded-[2.5rem] p-8 relative overflow-hidden group flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Leaf className="w-32 h-32 text-primary rotate-12" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center shadow-inner">
                <Leaf className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Carbon Footprint
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-7xl font-bold text-foreground tracking-tighter text-glow">
                {carbonEmission !== null ? carbonEmission.toFixed(1) : "0"}
              </span>
              <span className="text-2xl font-medium text-muted-foreground">
                kg CO₂e
              </span>
            </div>

            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              교통·식단·주거 입력값을 월간 기준으로 환산한 총 배출량입니다.
            </p>

            {carbonEmission !== null && (
              <div className="mt-8 flex items-center gap-4">
                <div className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-primary">
                    {stats.deltaPct === null
                      ? "—"
                      : `${stats.deltaPct > 0 ? "+" : ""}${stats.deltaPct.toFixed(1)}%`}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  직전 기록 대비
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Category Summary */}
        <div className="glass-card rounded-[2.5rem] p-8 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                카테고리별 배출
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                기록 전에는 교통·식단 예상치만 표시됩니다.
              </p>
            </div>
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </div>

          <div className="space-y-3">
            {[
              {
                label: "교통",
                value: visibleBreakdown.transportMonthlyKg,
                icon: <Bus className="w-4 h-4" />,
              },
              {
                label: "식단",
                value: visibleBreakdown.dietMonthlyKg,
                icon: <Utensils className="w-4 h-4" />,
              },
              {
                label: "주거",
                value: carbonBreakdown?.residentialMonthlyKg ?? 0,
                icon: <Home className="w-4 h-4" />,
              },
            ].map((item) => {
              const total = Math.max(
                visibleBreakdown.totalMonthlyKg,
                carbonEmission ?? 0,
                1,
              );
              const width = Math.min(
                100,
                Math.max(4, (item.value / total) * 100),
              );
              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 font-bold text-foreground">
                      <span className="text-primary">{item.icon}</span>
                      {item.label}
                    </div>
                    <span className="font-black text-foreground">
                      {formatKg(item.value)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-4">
            <p className="text-xs font-bold text-muted-foreground">연간 환산</p>
            <p className="text-2xl font-black text-foreground mt-1">
              {formatKg(
                (carbonBreakdown?.totalMonthlyKg ??
                  visibleBreakdown.totalMonthlyKg) * 12,
                0,
              )}{" "}
              CO₂e/년
            </p>
          </div>
        </div>
      </div>

      {/* Category Inputs */}
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black text-primary uppercase tracking-[0.24em]">
              Lifestyle Inputs
            </p>
            <h2 className="text-2xl font-black text-foreground mt-1">
              교통 · 식단 · 주거 기록
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
          <CategoryCard
            icon={<Car className="w-5 h-5 text-primary" />}
            title="교통"
            subtitle="주간 이동수단을 먼저 선택한 뒤, 해당 수단에 맞는 종류와 이동거리로 계산합니다."
          >
            <div className="space-y-4">
              <SelectBlock
                label="주간 이동수단"
                value={carbonCategoryInputs.publicTransitPattern}
                options={PUBLIC_TRANSIT_PATTERN_OPTIONS}
                onChange={(value) => {
                  const nextMode = value as PublicTransitPattern;
                  onCarbonCategoryInputChange("publicTransitPattern", nextMode);
                  onCarbonCategoryInputChange(
                    "carPattern",
                    getDefaultTransportDetailForMode(nextMode),
                  );
                  onCarbonCategoryInputChange(
                    "publicTransitDistance",
                    getDefaultTransportDistanceForMode(nextMode),
                  );
                }}
              />
              {shouldShowTransportDetail && transportDetailOptions.length > 0 && (
                <SelectBlock
                  label={transportDetailLabel}
                  value={carbonCategoryInputs.carPattern}
                  options={transportDetailOptions}
                  onChange={(value) =>
                    onCarbonCategoryInputChange("carPattern", value)
                  }
                />
              )}
              {shouldShowTransportDetail && transportDistanceOptions.length > 0 && (
                <SelectBlock
                  label={transportDistanceLabel}
                  value={carbonCategoryInputs.publicTransitDistance}
                  options={transportDistanceOptions}
                  onChange={(value) =>
                    onCarbonCategoryInputChange("publicTransitDistance", value)
                  }
                />
              )}
              <SelectBlock
                label="연간 비행거리"
                value={carbonCategoryInputs.flightPattern}
                options={FLIGHT_PATTERN_OPTIONS}
                onChange={(value) => {
                  onCarbonCategoryInputChange("flightPattern", value);
                  if (value === "none") {
                    onCarbonCategoryInputChange("flightTripsPerYear", 0);
                  } else if (carbonCategoryInputs.flightTripsPerYear === 0) {
                    onCarbonCategoryInputChange("flightTripsPerYear", 1);
                  }
                }}
              />
              <SelectBlock
                label="연간 비행 횟수"
                value={carbonCategoryInputs.flightTripsPerYear}
                options={FLIGHT_COUNT_OPTIONS}
                onChange={(value) =>
                  onCarbonCategoryInputChange(
                    "flightTripsPerYear",
                    Number(value),
                  )
                }
              />
              <div className="rounded-2xl bg-primary/10 border border-primary/15 p-4">
                <p className="text-xs font-bold text-primary">
                  현재 교통 추정치
                </p>
                <p className="text-2xl font-black text-foreground mt-1">
                  {formatKg(lifestylePreview.transportMonthlyKg)} / 월
                </p>
              </div>
            </div>
          </CategoryCard>

          <CategoryCard
            icon={<Utensils className="w-5 h-5 text-primary" />}
            title="식단"
            subtitle="1주일 기준 섭취량(kg)을 입력합니다."
          >
            <div className="grid grid-cols-2 gap-3">
              <MealInput
                label="소고기"
                value={carbonCategoryInputs.beefMealsPerWeek}
                factor={EMISSION_FACTORS.mealKg.beef}
                onChange={(value) =>
                  onCarbonCategoryInputChange("beefMealsPerWeek", value)
                }
              />
              <MealInput
                label="돼지고기"
                value={carbonCategoryInputs.porkMealsPerWeek}
                factor={EMISSION_FACTORS.mealKg.pork}
                onChange={(value) =>
                  onCarbonCategoryInputChange("porkMealsPerWeek", value)
                }
              />
              <MealInput
                label="닭고기"
                value={carbonCategoryInputs.chickenMealsPerWeek}
                factor={EMISSION_FACTORS.mealKg.chicken}
                onChange={(value) =>
                  onCarbonCategoryInputChange("chickenMealsPerWeek", value)
                }
              />
              <MealInput
                label="생선·해산물"
                value={carbonCategoryInputs.seafoodMealsPerWeek}
                factor={EMISSION_FACTORS.mealKg.seafood}
                onChange={(value) =>
                  onCarbonCategoryInputChange("seafoodMealsPerWeek", value)
                }
              />
              <div className="col-span-2">
                <MealInput
                  label="채식·두부"
                  value={carbonCategoryInputs.plantMealsPerWeek}
                  factor={EMISSION_FACTORS.mealKg.plant}
                  onChange={(value) =>
                    onCarbonCategoryInputChange("plantMealsPerWeek", value)
                  }
                />
              </div>
              <div className="col-span-2 rounded-2xl bg-primary/10 border border-primary/15 p-4">
                <p className="text-xs font-bold text-primary">
                  현재 식단 추정치
                </p>
                <p className="text-2xl font-black text-foreground mt-1">
                  {formatKg(lifestylePreview.dietMonthlyKg)} / 월
                </p>
              </div>
            </div>
          </CategoryCard>

          <CategoryCard
            icon={<Home className="w-5 h-5 text-primary" />}
            title="주거"
            subtitle="해당 수치는 금액으로부터 역환산 한 값이며 오차가 있을 수 있음."
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground ml-2 uppercase tracking-widest">
                  <Zap className="w-4 h-4 text-yellow-500" /> Electricity (고압
                  요금 역산)
                </label>
                <div className="relative group">
                  <input
                    type="number"
                    value={electricityBill}
                    onChange={handleElectricityChange}
                    placeholder="전기요금 입력"
                    className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-6 py-5 text-xl font-bold text-foreground placeholder:text-muted-foreground/50 border border-black/10 dark:border-white/5 focus:border-primary/50 focus:bg-black/10 dark:focus:bg-white/10 outline-none transition-all"
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                    원
                  </span>
                </div>
                {electricityUsage && (
                  <p className="text-xs text-right text-muted-foreground mr-2 font-medium">
                    누진세 환산 시 약{" "}
                    <span className="text-primary">{electricityUsage}</span> kWh
                    사용됨
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground ml-2 uppercase tracking-widest">
                  <Flame className="w-4 h-4 text-orange-500" /> Natural Gas
                  (요금 역산)
                </label>
                <div className="relative group">
                  <input
                    type="number"
                    value={gasBill}
                    onChange={handleGasChange}
                    placeholder="가스요금 입력"
                    className="w-full bg-black/5 dark:bg-white/5 rounded-2xl px-6 py-5 text-xl font-bold text-foreground placeholder:text-muted-foreground/50 border border-black/10 dark:border-white/5 focus:border-primary/50 focus:bg-black/10 dark:focus:bg-white/10 outline-none transition-all"
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                    원
                  </span>
                </div>
                {gasUsage && (
                  <p className="text-xs text-right text-muted-foreground mr-2 font-medium">
                    도시가스 요금 환산 시 약{" "}
                    <span className="text-primary">{gasUsage}</span> m³ 사용됨
                  </p>
                )}
              </div>

              <button
                onClick={() => void handleCalculate()}
                disabled={
                  isCalculating ||
                  isSaving ||
                  (!hasResidentialInput && !hasLifestyleInput)
                }
                className="w-full bg-primary text-primary-foreground rounded-2xl py-5 text-lg font-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:hover:scale-100 shadow-[0_20px_50px_rgba(74,222,128,0.3)]"
              >
                {isCalculating || isSaving ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    <span>SAVING...</span>
                  </div>
                ) : (
                  "전체 탄소 배출량 기록하기"
                )}
              </button>
            </div>
          </CategoryCard>
        </div>
      </div>

      {/* Chart Section */}
      <div className="glass-card rounded-[2.5rem] p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-foreground">
              배출량 히스토리
            </h3>
            {stats.count > 0 && (
              <span className="text-xs font-bold text-muted-foreground bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 px-2 py-1 rounded-full">
                최근 {stats.count}회
              </span>
            )}
          </div>
          <History className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="h-72 w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
              <div className="w-16 h-16 rounded-3xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 opacity-40" />
              </div>
              <p className="text-sm font-medium">표시할 데이터가 아직 없어요</p>
              <p className="text-xs text-muted-foreground">
                교통·식단·주거 정보를 입력하고 기록하면 그래프가 채워져요.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCarbon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ADE80" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4ADE80" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 11, fontWeight: 600 }}
                  dy={15}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 11, fontWeight: 600 }}
                  tickFormatter={(value) => `${value}kg`}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(74,222,128,0.2)", strokeWidth: 2 }}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "16px",
                    color: "var(--foreground)",
                    boxShadow: "0 10px 30px var(--glass-shadow)",
                    padding: "12px 16px",
                  }}
                  itemStyle={{ color: "#4ADE80", fontWeight: "bold" }}
                  labelStyle={{
                    color: "var(--muted-foreground)",
                    marginBottom: "4px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="carbon"
                  stroke="#4ADE80"
                  strokeWidth={4}
                  fill="url(#colorCarbon)"
                  animationDuration={1500}
                  activeDot={{ r: 6, strokeWidth: 0, fill: "#4ADE80" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 대표값 및 요금 계산 기준 안내 */}
      <div className="text-[11px] text-muted-foreground/50 bg-black/5 dark:bg-white/5 rounded-2xl p-4 space-y-1.5">
        <p className="font-bold text-muted-foreground/70 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          계산 기준 안내
        </p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li>
            전기요금 역산 기준: 한국전력 주택용 고압, 기타계절 기준의 참고용
            근사치입니다.
          </li>
          <li>
            누진제: 1단계(~200kWh) 105.0원 / 2단계(201~400kWh) 174.0원 /
            3단계(400초과) 242.3원
          </li>
          <li>기본요금: 1단계 730원 / 2단계 1,260원 / 3단계 6,060원</li>
          <li>별도요금: 기후환경요금(9원/kWh) 및 연료비조정요금(5원/kWh)</li>
          <li>제세공과금: 부가가치세 10% 및 전력산업기반기금 2.7% 반영</li>
          <li>
            가스요금 역산 기준: 기본요금 {GAS_BILL_CONFIG.basicFee.toLocaleString()}원,
            단가 {GAS_BILL_CONFIG.unitPricePerMj}원/MJ, 평균열량{" "}
            {GAS_BILL_CONFIG.averageCalorificValueMjPerM3}MJ/m³, 보정계수{" "}
            {GAS_BILL_CONFIG.correctionFactor}, 부가가치세 10%를 반영한 참고용
            근사치입니다.
          </li>
          <li>
            복지제도 적용, 기타 할인 적용 등에 따라 오차가 발생할 수 있습니다.
          </li>
        </ul>
        <p className="pt-1 opacity-70">
          ※ 10원 단위 절사 규정으로 인해 입력된 요금에서 역산된 전력량(kWh)은
          산출된 근사치입니다.
        </p>
      </div>
    </div>
  );
}
