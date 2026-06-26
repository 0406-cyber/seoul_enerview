export const CAR_PATTERN_OPTIONS = [
  {
    value: "none",
    label: "거의 안탐/재택",
    description: "엑셀 대표값 기준 주 30km 이동",
    weeklyKm: 30,
  },
  {
    value: "local",
    label: "동네 위주",
    description: "엑셀 대표값 기준 주 80km 이동",
    weeklyKm: 80,
  },
  {
    value: "commuteShort",
    label: "출퇴근 30분 이내",
    description: "엑셀 대표값 기준 주 185km 이동",
    weeklyKm: 185,
  },
  {
    value: "longDistance",
    label: "장거리 이동 잦음",
    description: "엑셀 대표값 기준 주 400km 이동",
    weeklyKm: 400,
  },
] as const;

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
    label: "대중교통 중심",
    description: "주 10회 기준, 이동 거리에 따라 지하철·버스 계수를 적용",
    weeklyTrips: 10,
    averageKmPerTrip: 12,
    kgPerKm: 0.041,
  },
  {
    value: "carCommute",
    label: "자가용 중심",
    description: "주 10회 기준, 이동 거리는 아래에서 선택",
    weeklyTrips: 10,
    averageKmPerTrip: 12,
    kgPerKm: 0.192,
  },
] as const;

export const PUBLIC_TRANSIT_DISTANCE_OPTIONS = [
  {
    value: "near",
    label: "단거리",
    description: "엑셀 대표값 기준 편도 5km, 지하철 0.041kg CO₂/km 적용",
    averageKmPerTrip: 5,
    kgPerKm: 0.041,
  },
  {
    value: "medium",
    label: "중거리",
    description: "엑셀 대표값 기준 편도 12km, 버스 0.089kg CO₂/km 적용",
    averageKmPerTrip: 12,
    kgPerKm: 0.089,
  },
  {
    value: "long",
    label: "장거리",
    description: "엑셀 대표값 기준 편도 25km, 버스 국내 평균 계수 준용",
    averageKmPerTrip: 25,
    kgPerKm: 0.089,
  },
] as const;

export const FLIGHT_PATTERN_OPTIONS = [
  {
    value: "none",
    label: "비행기 이용 없음",
    description: "최근 1년 기준",
    annualKm: 0,
    oneWayKm: 0,
    oneWayKg: 0,
  },
  {
    value: "domestic",
    label: "국내선",
    description: "김포-제주 편도 453km, 왕복 906km 기준",
    annualKm: 906,
    oneWayKm: 453,
    oneWayKg: 52.095,
  },
  {
    value: "shortInternational",
    label: "단거리 국제선",
    description: "일본·중국 편도 평균 1,100km, 왕복 2,200km 기준",
    annualKm: 2_200,
    oneWayKm: 1_100,
    oneWayKg: 126.5,
  },
  {
    value: "midInternational",
    label: "중거리 국제선",
    description: "동남아 편도 평균 4,500km, 왕복 9,000km 기준",
    annualKm: 9_000,
    oneWayKm: 4_500,
    oneWayKg: 517.5,
  },
  {
    value: "europeAfrica",
    label: "유럽·중동·아프리카",
    description: "편도 평균 8,500km, 왕복 17,000km 기준",
    annualKm: 17_000,
    oneWayKm: 8_500,
    oneWayKg: 977.5,
  },
  {
    value: "americas",
    label: "미주·오세아니아",
    description: "편도 평균 9,300km, 왕복 18,600km 기준",
    annualKm: 18_600,
    oneWayKm: 9_300,
    oneWayKg: 1_069.5,
  },
] as const;

export const FLIGHT_COUNT_OPTIONS = [
  {
    value: 0,
    label: "이용 없음",
    description: "최근 1년 기준 비행기 이용 없음",
  },
  {
    value: 1,
    label: "연 1회",
    description: "선택한 왕복 거리 1회 반영",
  },
  {
    value: 2,
    label: "연 2회",
    description: "선택한 왕복 거리 2회 반영",
  },
  {
    value: 3,
    label: "연 3회",
    description: "선택한 왕복 거리 3회 반영",
  },
  {
    value: 4,
    label: "연 4회",
    description: "선택한 왕복 거리 4회 반영",
  },
  {
    value: 6,
    label: "연 5회 이상",
    description: "대표값으로 연 6회 반영",
  },
] as const;

export type CarPattern = (typeof CAR_PATTERN_OPTIONS)[number]["value"];
export type PublicTransitPattern =
  (typeof PUBLIC_TRANSIT_PATTERN_OPTIONS)[number]["value"];
export type PublicTransitDistance =
  (typeof PUBLIC_TRANSIT_DISTANCE_OPTIONS)[number]["value"];
export type FlightPattern = (typeof FLIGHT_PATTERN_OPTIONS)[number]["value"];

export interface CarbonCategoryInputValues {
  carPattern: CarPattern;
  publicTransitPattern: PublicTransitPattern;
  publicTransitDistance: PublicTransitDistance;
  flightPattern: FlightPattern;
  flightTripsPerYear: number;
  beefMealsPerWeek: number;
  porkMealsPerWeek: number;
  chickenMealsPerWeek: number;
  seafoodMealsPerWeek: number;
  plantMealsPerWeek: number;
}

export interface CarbonBreakdown {
  residentialMonthlyKg: number;
  transportMonthlyKg: number;
  dietMonthlyKg: number;
  totalMonthlyKg: number;
  annualKg: number;
  details: {
    carAnnualKg: number;
    publicTransitAnnualKg: number;
    flightAnnualKg: number;
    dietAnnualKg: number;
  };
}

export const DEFAULT_CARBON_CATEGORY_INPUTS: CarbonCategoryInputValues = {
  carPattern: "none",
  publicTransitPattern: "walkBike",
  publicTransitDistance: "near",
  flightPattern: "none",
  flightTripsPerYear: 0,
  beefMealsPerWeek: 0,
  porkMealsPerWeek: 0,
  chickenMealsPerWeek: 0,
  seafoodMealsPerWeek: 0,
  plantMealsPerWeek: 0,
};

// 탄소배출계수.xlsx 기준.
// 엑셀의 이동거리 대표값은 음수로 입력되어 있지만, 배출량 산정에는 이동거리의 절댓값을 사용합니다.
// 단위: kgCO2e
export const EMISSION_FACTORS = {
  passengerCarKgPerKm: 0.192,
  publicTransitKgPerKm: {
    subway: 0.041,
    bus: 0.089,
  },
  flightKgPerPassengerKm: 0.115,
  mealKg: {
    beef: 100,
    pork: 12,
    chicken: 7,
    seafood: 5,
    plant: 1,
  },
} as const;

const getByValue = <T extends readonly { value: string }[]>(
  options: T,
  value: string,
): T[number] => {
  return options.find((option) => option.value === value) ?? options[0];
};

const toSafeNumber = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
};

export function calculateCarbonBreakdown(
  residentialMonthlyKg: number,
  inputs: CarbonCategoryInputValues,
): CarbonBreakdown {
  const car = getByValue(CAR_PATTERN_OPTIONS, inputs.carPattern);
  const publicTransit = getByValue(
    PUBLIC_TRANSIT_PATTERN_OPTIONS,
    inputs.publicTransitPattern,
  );
  const publicTransitDistance = getByValue(
    PUBLIC_TRANSIT_DISTANCE_OPTIONS,
    inputs.publicTransitDistance,
  );
  const flight = getByValue(FLIGHT_PATTERN_OPTIONS, inputs.flightPattern);
  const flightTripsPerYear =
    flight.value === "none" ? 0 : toSafeNumber(inputs.flightTripsPerYear);

  const carAnnualKg = car.weeklyKm * 52 * EMISSION_FACTORS.passengerCarKgPerKm;
  const publicTransitKgPerKm =
    publicTransit.value === "carCommute"
      ? EMISSION_FACTORS.passengerCarKgPerKm
      : publicTransitDistance.kgPerKm;
  const publicTransitAnnualKg =
    publicTransit.value === "walkBike"
      ? 0
      : publicTransit.weeklyTrips *
        publicTransitDistance.averageKmPerTrip *
        52 *
        publicTransitKgPerKm;
  const flightAnnualKg =
    flight.annualKm *
    flightTripsPerYear *
    EMISSION_FACTORS.flightKgPerPassengerKm;

  const dietAnnualKg =
    (toSafeNumber(inputs.beefMealsPerWeek) * EMISSION_FACTORS.mealKg.beef +
      toSafeNumber(inputs.porkMealsPerWeek) * EMISSION_FACTORS.mealKg.pork +
      toSafeNumber(inputs.chickenMealsPerWeek) *
        EMISSION_FACTORS.mealKg.chicken +
      toSafeNumber(inputs.seafoodMealsPerWeek) *
        EMISSION_FACTORS.mealKg.seafood +
      toSafeNumber(inputs.plantMealsPerWeek) * EMISSION_FACTORS.mealKg.plant) *
    52;

  const transportMonthlyKg =
    (carAnnualKg + publicTransitAnnualKg + flightAnnualKg) / 12;
  const dietMonthlyKg = dietAnnualKg / 12;
  const safeResidentialMonthlyKg = toSafeNumber(residentialMonthlyKg);
  const totalMonthlyKg =
    safeResidentialMonthlyKg + transportMonthlyKg + dietMonthlyKg;

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
  };
}

export interface UsageCarbonDetails {
  residential_co2_kg: number;
  transport_co2_kg: number;
  diet_co2_kg: number;
  annual_co2_kg: number;
  car_annual_co2_kg: number;
  public_transit_annual_co2_kg: number;
  flight_annual_co2_kg: number;
  diet_annual_co2_kg: number;
  car_pattern: CarPattern;
  public_transit_pattern: PublicTransitPattern;
  public_transit_distance: PublicTransitDistance;
  flight_pattern: FlightPattern;
  flight_trips_per_year: number;
  beef_meals_per_week: number;
  pork_meals_per_week: number;
  chicken_meals_per_week: number;
  seafood_meals_per_week: number;
  plant_meals_per_week: number;
}

const hasValue = (value: unknown) =>
  value !== null && value !== undefined && value !== "";

const numberOrDefault = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const isOptionValue = <T extends readonly { value: string }[]>(
  options: T,
  value: unknown,
): value is T[number]["value"] => {
  return (
    typeof value === "string" &&
    options.some((option) => option.value === value)
  );
};

export function createUsageCarbonDetails(
  inputs: CarbonCategoryInputValues,
  breakdown: CarbonBreakdown,
): UsageCarbonDetails {
  return {
    residential_co2_kg: breakdown.residentialMonthlyKg,
    transport_co2_kg: breakdown.transportMonthlyKg,
    diet_co2_kg: breakdown.dietMonthlyKg,
    annual_co2_kg: breakdown.annualKg,
    car_annual_co2_kg: breakdown.details.carAnnualKg,
    public_transit_annual_co2_kg: breakdown.details.publicTransitAnnualKg,
    flight_annual_co2_kg: breakdown.details.flightAnnualKg,
    diet_annual_co2_kg: breakdown.details.dietAnnualKg,
    car_pattern: inputs.carPattern,
    public_transit_pattern: inputs.publicTransitPattern,
    public_transit_distance: inputs.publicTransitDistance,
    flight_pattern: inputs.flightPattern,
    flight_trips_per_year: inputs.flightTripsPerYear,
    beef_meals_per_week: inputs.beefMealsPerWeek,
    pork_meals_per_week: inputs.porkMealsPerWeek,
    chicken_meals_per_week: inputs.chickenMealsPerWeek,
    seafood_meals_per_week: inputs.seafoodMealsPerWeek,
    plant_meals_per_week: inputs.plantMealsPerWeek,
  };
}

export function restoreCarbonCategoryInputsFromUsage(
  record: Partial<UsageCarbonDetails>,
): CarbonCategoryInputValues | null {
  if (
    !hasValue(record.car_pattern) &&
    !hasValue(record.public_transit_pattern) &&
    !hasValue(record.public_transit_distance) &&
    !hasValue(record.flight_pattern) &&
    !hasValue(record.flight_trips_per_year) &&
    !hasValue(record.beef_meals_per_week) &&
    !hasValue(record.pork_meals_per_week) &&
    !hasValue(record.chicken_meals_per_week) &&
    !hasValue(record.seafood_meals_per_week) &&
    !hasValue(record.plant_meals_per_week)
  ) {
    return null;
  }

  const flightPattern = isOptionValue(
    FLIGHT_PATTERN_OPTIONS,
    record.flight_pattern,
  )
    ? record.flight_pattern
    : DEFAULT_CARBON_CATEGORY_INPUTS.flightPattern;

  return {
    carPattern: isOptionValue(CAR_PATTERN_OPTIONS, record.car_pattern)
      ? record.car_pattern
      : DEFAULT_CARBON_CATEGORY_INPUTS.carPattern,
    publicTransitPattern: isOptionValue(
      PUBLIC_TRANSIT_PATTERN_OPTIONS,
      record.public_transit_pattern,
    )
      ? record.public_transit_pattern
      : DEFAULT_CARBON_CATEGORY_INPUTS.publicTransitPattern,
    publicTransitDistance: isOptionValue(
      PUBLIC_TRANSIT_DISTANCE_OPTIONS,
      record.public_transit_distance,
    )
      ? record.public_transit_distance
      : DEFAULT_CARBON_CATEGORY_INPUTS.publicTransitDistance,
    flightPattern,
    flightTripsPerYear: hasValue(record.flight_trips_per_year)
      ? numberOrDefault(record.flight_trips_per_year)
      : flightPattern === "none"
        ? 0
        : 1,
    beefMealsPerWeek: numberOrDefault(record.beef_meals_per_week),
    porkMealsPerWeek: numberOrDefault(record.pork_meals_per_week),
    chickenMealsPerWeek: numberOrDefault(record.chicken_meals_per_week),
    seafoodMealsPerWeek: numberOrDefault(record.seafood_meals_per_week),
    plantMealsPerWeek: numberOrDefault(record.plant_meals_per_week),
  };
}

export function restoreCarbonBreakdownFromUsage(
  record: Partial<UsageCarbonDetails> & { co2_kg?: number },
): CarbonBreakdown | null {
  if (
    !hasValue(record.residential_co2_kg) &&
    !hasValue(record.transport_co2_kg) &&
    !hasValue(record.diet_co2_kg) &&
    !hasValue(record.annual_co2_kg)
  ) {
    return null;
  }

  const residentialMonthlyKg = numberOrDefault(record.residential_co2_kg);
  const transportMonthlyKg = numberOrDefault(record.transport_co2_kg);
  const dietMonthlyKg = numberOrDefault(record.diet_co2_kg);
  const totalMonthlyKg = numberOrDefault(
    record.co2_kg,
    residentialMonthlyKg + transportMonthlyKg + dietMonthlyKg,
  );

  return {
    residentialMonthlyKg,
    transportMonthlyKg,
    dietMonthlyKg,
    totalMonthlyKg,
    annualKg: numberOrDefault(record.annual_co2_kg, totalMonthlyKg * 12),
    details: {
      carAnnualKg: numberOrDefault(record.car_annual_co2_kg),
      publicTransitAnnualKg: numberOrDefault(
        record.public_transit_annual_co2_kg,
      ),
      flightAnnualKg: numberOrDefault(record.flight_annual_co2_kg),
      dietAnnualKg: numberOrDefault(record.diet_annual_co2_kg),
    },
  };
}
