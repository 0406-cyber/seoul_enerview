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
] as const;

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
export type FlightPattern = (typeof FLIGHT_PATTERN_OPTIONS)[number]["value"];

export interface CarbonCategoryInputValues {
  carPattern: CarPattern;
  publicTransitPattern: PublicTransitPattern;
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
  flightPattern: "none",
  flightTripsPerYear: 0,
  beefMealsPerWeek: 0,
  porkMealsPerWeek: 0,
  chickenMealsPerWeek: 0,
  seafoodMealsPerWeek: 0,
  plantMealsPerWeek: 0,
};

// TODO: 대표값 확정 시 아래 계수만 교체하면 UI/저장 흐름은 그대로 유지됩니다.
// 단위: kgCO2e
export const EMISSION_FACTORS = {
  passengerCarKgPerKm: 0,
  flightKgPerPassengerKm: 0,
  mealKg: {
    beef: 0,
    pork: 0,
    chicken: 0,
    seafood: 0,
    plant: 0,
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
  const flight = getByValue(FLIGHT_PATTERN_OPTIONS, inputs.flightPattern);
  const flightTripsPerYear =
    flight.value === "none" ? 0 : toSafeNumber(inputs.flightTripsPerYear);

  const carAnnualKg = car.weeklyKm * 52 * EMISSION_FACTORS.passengerCarKgPerKm;
  const publicTransitAnnualKg =
    publicTransit.weeklyTrips *
    publicTransit.averageKmPerTrip *
    52 *
    publicTransit.kgPerKm;
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
