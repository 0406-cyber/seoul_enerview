export const CAR_PATTERN_OPTIONS = [
  {
    value: "none",
    label: "차량 이용 거의 없음",
    description: "도보·자전거·대중교통 중심",
    weeklyKm: 0,
  },
  {
    value: "local",
    label: "동네 생활권",
    description: "장보기·학원·근거리 이동 중심",
    weeklyKm: 35,
  },
  {
    value: "commuteShort",
    label: "출퇴근 30분 이내",
    description: "평일 왕복 근거리 통근 기준",
    weeklyKm: 120,
  },
  {
    value: "longDistance",
    label: "장거리 이동 잦음",
    description: "주말 외곽 이동·출장 포함",
    weeklyKm: 260,
  },
] as const

export const PUBLIC_TRANSIT_PATTERN_OPTIONS = [
  {
    value: "walkBike",
    label: "도보·자전거 중심",
    description: "주간 대중교통 이용 거의 없음",
    weeklyTrips: 0,
    averageKmPerTrip: 0,
    kgPerKm: 0,
  },
  {
    value: "metroBus",
    label: "지하철·버스 중심",
    description: "주 10회, 1회 평균 8km 가정",
    weeklyTrips: 10,
    averageKmPerTrip: 8,
    kgPerKm: 0.045,
  },
  {
    value: "carCommute",
    label: "자가용 중심",
    description: "주 10회, 1회 평균 8km 가정",
    weeklyTrips: 10,
    averageKmPerTrip: 8,
    kgPerKm: 0.192,
  },
] as const

export const FLIGHT_PATTERN_OPTIONS = [
  {
    value: "none",
    label: "비행기 이용 없음",
    description: "최근 1년 기준",
    annualKm: 0,
  },
  {
    value: "domestic",
    label: "국내선",
    description: "서울-제주 왕복 1회 수준",
    annualKm: 900,
  },
  {
    value: "shortInternational",
    label: "단거리 국제선",
    description: "일본·중국 왕복 1회 수준",
    annualKm: 2_400,
  },
  {
    value: "midInternational",
    label: "중거리 국제선",
    description: "동남아시아 왕복 1회 수준",
    annualKm: 7_200,
  },
  {
    value: "europeAfrica",
    label: "유럽·아프리카",
    description: "장거리 왕복 1회 수준",
    annualKm: 18_000,
  },
  {
    value: "americas",
    label: "미주",
    description: "장거리 왕복 1회 수준",
    annualKm: 21_000,
  },
] as const

export type CarPattern = (typeof CAR_PATTERN_OPTIONS)[number]["value"]
export type PublicTransitPattern = (typeof PUBLIC_TRANSIT_PATTERN_OPTIONS)[number]["value"]
export type FlightPattern = (typeof FLIGHT_PATTERN_OPTIONS)[number]["value"]

export interface CarbonCategoryInputValues {
  carPattern: CarPattern
  publicTransitPattern: PublicTransitPattern
  flightPattern: FlightPattern
  beefMealsPerWeek: number
  porkMealsPerWeek: number
  chickenMealsPerWeek: number
  seafoodMealsPerWeek: number
  plantMealsPerWeek: number
}

export interface CarbonBreakdown {
  residentialMonthlyKg: number
  transportMonthlyKg: number
  dietMonthlyKg: number
  totalMonthlyKg: number
  annualKg: number
  details: {
    carAnnualKg: number
    publicTransitAnnualKg: number
    flightAnnualKg: number
    dietAnnualKg: number
  }
}

export const DEFAULT_CARBON_CATEGORY_INPUTS: CarbonCategoryInputValues = {
  carPattern: "none",
  publicTransitPattern: "walkBike",
  flightPattern: "none",
  beefMealsPerWeek: 0,
  porkMealsPerWeek: 0,
  chickenMealsPerWeek: 0,
  seafoodMealsPerWeek: 0,
  plantMealsPerWeek: 0,
}

// TODO: 대표값 확정 시 아래 계수만 교체하면 UI/저장 흐름은 그대로 유지됩니다.
// 단위: kgCO2e
export const EMISSION_FACTORS = {
  passengerCarKgPerKm: 0.192,
  flightKgPerPassengerKm: 0.158,
  mealKg: {
    beef: 7.2,
    pork: 2.4,
    chicken: 1.6,
    seafood: 1.8,
    plant: 0.4,
  },
} as const

const getByValue = <T extends readonly { value: string }[]>(options: T, value: string): T[number] => {
  return options.find((option) => option.value === value) ?? options[0]
}

const toSafeNumber = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) return 0
  return value
}

export function calculateCarbonBreakdown(
  residentialMonthlyKg: number,
  inputs: CarbonCategoryInputValues
): CarbonBreakdown {
  const car = getByValue(CAR_PATTERN_OPTIONS, inputs.carPattern)
  const publicTransit = getByValue(PUBLIC_TRANSIT_PATTERN_OPTIONS, inputs.publicTransitPattern)
  const flight = getByValue(FLIGHT_PATTERN_OPTIONS, inputs.flightPattern)

  const carAnnualKg = car.weeklyKm * 52 * EMISSION_FACTORS.passengerCarKgPerKm
  const publicTransitAnnualKg =
    publicTransit.weeklyTrips * publicTransit.averageKmPerTrip * 52 * publicTransit.kgPerKm
  const flightAnnualKg = flight.annualKm * EMISSION_FACTORS.flightKgPerPassengerKm

  const dietAnnualKg =
    (toSafeNumber(inputs.beefMealsPerWeek) * EMISSION_FACTORS.mealKg.beef +
      toSafeNumber(inputs.porkMealsPerWeek) * EMISSION_FACTORS.mealKg.pork +
      toSafeNumber(inputs.chickenMealsPerWeek) * EMISSION_FACTORS.mealKg.chicken +
      toSafeNumber(inputs.seafoodMealsPerWeek) * EMISSION_FACTORS.mealKg.seafood +
      toSafeNumber(inputs.plantMealsPerWeek) * EMISSION_FACTORS.mealKg.plant) *
    52

  const transportMonthlyKg = (carAnnualKg + publicTransitAnnualKg + flightAnnualKg) / 12
  const dietMonthlyKg = dietAnnualKg / 12
  const safeResidentialMonthlyKg = toSafeNumber(residentialMonthlyKg)
  const totalMonthlyKg = safeResidentialMonthlyKg + transportMonthlyKg + dietMonthlyKg

  return {
    residentialMonthlyKg: safeResidentialMonthlyKg,
    transportMonthlyKg,
    dietMonthlyKg,
    totalMonthlyKg,
    annualKg: totalMonthlyKg * 12,
    details: {
      carAnnualKg,
      publicTransitAnnualKg,
      flightAnnualKg,
      dietAnnualKg,
    },
  }
}
