"use server";

import { getRequestContext } from "@cloudflare/next-on-pages";
import type { UsageCarbonDetails } from "@/lib/carbon-categories";

export type UsageRow = {
  username?: string;
  date: string;
  elec_kwh: number;
  gas_m3: number;
  co2_kg: number;
} & Partial<UsageCarbonDetails>;

// Cloudflare Context로부터 D1 DB 인스턴스를 가져오는 헬퍼 함수
function getDb() {
  try {
    const context = getRequestContext();
    if (context && context.env && context.env.DB) {
      return context.env.DB;
    }
  } catch (e) {
    // 빌드 타임 혹은 비런타임 대비 예외 처리
  }
  return (process.env as any).DB;
}

// CO2 계산 함수
export async function computeCo2Kg(
  elecKwh: number,
  gasM3: number,
): Promise<number> {
  return elecKwh * 0.4781 + gasM3 * 2.176;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const round2 = (value: number | null | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parseFloat(parsed.toFixed(2)) : 0;
};

const textOrEmpty = (value: string | null | undefined): string => value ?? "";

type DeviceClientHints = {
  brands?: string | null;
  mobile?: string | null;
  platform?: string | null;
};

const cleanDevicePart = (value: string | null | undefined): string =>
  String(value ?? "")
    .replace(/^"|"$/g, "")
    .replace(/_/g, ".")
    .replace(/\s+/g, " ")
    .trim();

const browserFromClientHints = (brands: string | null | undefined): string | null => {
  if (!brands) return null;

  const parsed = [...brands.matchAll(/"([^";]+)";v="([^";]+)"/g)]
    .map((match) => ({ name: match[1], version: match[2] }))
    .filter((brand) => !/not[ ._-]?a[ ._-]?brand/i.test(brand.name));

  const preferred = [
    "Microsoft Edge",
    "Google Chrome",
    "Brave",
    "Opera",
    "Samsung Internet",
    "Naver Whale",
    "Chromium",
  ];

  const selected =
    preferred
      .map((name) => parsed.find((brand) => brand.name.toLowerCase() === name.toLowerCase()))
      .find(Boolean) ?? parsed[0];

  return selected ? `${selected.name} ${selected.version}` : null;
};

const detectBrowser = (userAgent: string, hints?: DeviceClientHints): string => {
  const chBrowser = browserFromClientHints(hints?.brands);

  const checks: Array<[RegExp, string]> = [
    [/SamsungBrowser\/([\d.]+)/i, "Samsung Internet"],
    [/Whale\/([\d.]+)/i, "Naver Whale"],
    [/(?:Edg|EdgA|EdgiOS)\/([\d.]+)/i, "Microsoft Edge"],
    [/(?:OPR|Opera)\/([\d.]+)/i, "Opera"],
    [/CriOS\/([\d.]+)/i, "Chrome iOS"],
    [/FxiOS\/([\d.]+)/i, "Firefox iOS"],
    [/Firefox\/([\d.]+)/i, "Firefox"],
    [/(?:Chrome|Chromium)\/([\d.]+)/i, "Chrome"],
    [/Version\/([\d.]+).*Safari\//i, "Safari"],
    [/(?:MSIE |rv:)([\d.]+).*Trident/i, "Internet Explorer"],
  ];

  for (const [pattern, name] of checks) {
    const match = userAgent.match(pattern);
    if (match?.[1]) return `${name} ${match[1]}`;
  }

  return chBrowser ?? "Unknown Browser";
};

const detectOs = (userAgent: string, hints?: DeviceClientHints): string => {
  const platformHint = cleanDevicePart(hints?.platform);

  const windowsVersion = userAgent.match(/Windows NT ([\d.]+)/i)?.[1];
  if (windowsVersion) {
    const versions: Record<string, string> = {
      "10.0": "Windows 10/11",
      "6.3": "Windows 8.1",
      "6.2": "Windows 8",
      "6.1": "Windows 7",
    };
    return versions[windowsVersion] ?? `Windows NT ${windowsVersion}`;
  }

  const androidVersion = userAgent.match(/Android ([\d.]+)/i)?.[1];
  if (androidVersion) return `Android ${androidVersion}`;

  const ipadOsVersion = userAgent.match(/CPU OS ([\d_]+)/i)?.[1];
  if (/iPad/i.test(userAgent) && ipadOsVersion) return `iPadOS ${cleanDevicePart(ipadOsVersion)}`;

  const iosVersion =
    userAgent.match(/iPhone OS ([\d_]+)/i)?.[1] ??
    userAgent.match(/CPU(?: iPhone)? OS ([\d_]+)/i)?.[1];
  if (iosVersion) return `iOS ${cleanDevicePart(iosVersion)}`;

  const macVersion = userAgent.match(/Mac OS X ([\d_]+)/i)?.[1];
  if (macVersion) return `macOS ${cleanDevicePart(macVersion)}`;

  const chromeOsVersion = userAgent.match(/CrOS [^ ]+ ([\d.]+)/i)?.[1];
  if (chromeOsVersion) return `ChromeOS ${chromeOsVersion}`;

  if (/Linux/i.test(userAgent)) return "Linux";
  if (platformHint) return platformHint;

  return "Unknown OS";
};

const detectDeviceType = (userAgent: string, hints?: DeviceClientHints): string => {
  if (/bot|crawler|spider|crawling|slurp|bingpreview/i.test(userAgent)) return "Bot";

  if (hints?.mobile === "?1") return "Mobile";

  if (/iPad|Tablet|Kindle|Silk|PlayBook|Nexus 7|Nexus 10|SM-T|Tab/i.test(userAgent)) {
    return "Tablet";
  }

  if (/Mobile|Android.*Mobile|iPhone|iPod/i.test(userAgent)) return "Mobile";
  if (/Android/i.test(userAgent)) return "Tablet";
  if (hints?.mobile === "?0") return "Desktop";

  return "Desktop";
};

const detectDeviceModel = (userAgent: string): string => {
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/iPod/i.test(userAgent)) return "iPod";

  const androidModel = userAgent.match(/Android [\d.]+;\s*([^;)]+?)(?:\s+Build\/|;|\))/i)?.[1];
  if (androidModel) {
    const model = cleanDevicePart(androidModel.replace(/\bwv\b/gi, ""));
    if (model && !/^(mobile|tablet)$/i.test(model)) return model;
  }

  if (/Windows NT/i.test(userAgent)) return "Windows PC";
  if (/Macintosh/i.test(userAgent)) return "Mac";
  if (/CrOS/i.test(userAgent)) return "Chromebook";

  return "";
};

const buildDeviceLabel = (userAgent: string, hints?: DeviceClientHints): string => {
  if (!userAgent || userAgent === "Unknown Device") return "Unknown Device";

  const type = detectDeviceType(userAgent, hints);
  const model = detectDeviceModel(userAgent);
  const os = detectOs(userAgent, hints);
  const browser = detectBrowser(userAgent, hints);

  return [type, model, os, browser]
    .filter((part, index, parts) => part && !part.startsWith("Unknown") && parts.indexOf(part) === index)
    .join(" · ") || type;
};

const isMissingColumnError = (error: unknown): boolean => {
  const message = String((error as any)?.message ?? error);
  return (
    message.includes("no column") ||
    message.includes("has no column") ||
    message.includes("table usage has no column") ||
    message.includes("no such column")
  );
};

/** 1. 데이터 저장 기능 (usage 테이블) */
export async function saveUsage(
  username: string,
  elec: number,
  gas: number,
  co2: number,
  details?: Partial<UsageCarbonDetails>,
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("D1 데이터베이스가 바인딩되지 않았습니다.");

  const date = todayYmd();
  const baseValues = [username, date, round2(elec), round2(gas), round2(co2)];

  const extendedValues = [
    round2(details?.residential_co2_kg),
    round2(details?.transport_co2_kg),
    round2(details?.diet_co2_kg),
    round2(details?.annual_co2_kg),
    round2(details?.car_annual_co2_kg),
    round2(details?.public_transit_annual_co2_kg),
    round2(details?.flight_annual_co2_kg),
    round2(details?.diet_annual_co2_kg),
    textOrEmpty(details?.car_pattern),
    textOrEmpty(details?.public_transit_pattern),
    textOrEmpty(details?.flight_pattern),
  ];

  const extendedValuesWithDistance = [
    round2(details?.residential_co2_kg),
    round2(details?.transport_co2_kg),
    round2(details?.diet_co2_kg),
    round2(details?.annual_co2_kg),
    round2(details?.car_annual_co2_kg),
    round2(details?.public_transit_annual_co2_kg),
    round2(details?.flight_annual_co2_kg),
    round2(details?.diet_annual_co2_kg),
    textOrEmpty(details?.car_pattern),
    textOrEmpty(details?.public_transit_pattern),
    textOrEmpty(details?.public_transit_distance),
    textOrEmpty(details?.flight_pattern),
  ];

  const mealValues = [
    round2(details?.beef_meals_per_week),
    round2(details?.pork_meals_per_week),
    round2(details?.chicken_meals_per_week),
    round2(details?.seafood_meals_per_week),
    round2(details?.plant_meals_per_week),
  ];

  try {
    await db
      .prepare(
        `INSERT INTO usage (
        username, date, elec_kwh, gas_m3, co2_kg,
        residential_co2_kg, transport_co2_kg, diet_co2_kg, annual_co2_kg,
        car_annual_co2_kg, public_transit_annual_co2_kg, flight_annual_co2_kg, diet_annual_co2_kg,
        car_pattern, public_transit_pattern, public_transit_distance, flight_pattern, flight_trips_per_year,
        beef_meals_per_week, pork_meals_per_week, chicken_meals_per_week, seafood_meals_per_week, plant_meals_per_week
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        ...baseValues,
        ...extendedValuesWithDistance,
        round2(details?.flight_trips_per_year),
        ...mealValues,
      )
      .run();
    return;
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
  }

  try {
    await db
      .prepare(
        `INSERT INTO usage (
        username, date, elec_kwh, gas_m3, co2_kg,
        residential_co2_kg, transport_co2_kg, diet_co2_kg, annual_co2_kg,
        car_annual_co2_kg, public_transit_annual_co2_kg, flight_annual_co2_kg, diet_annual_co2_kg,
        car_pattern, public_transit_pattern, flight_pattern, flight_trips_per_year,
        beef_meals_per_week, pork_meals_per_week, chicken_meals_per_week, seafood_meals_per_week, plant_meals_per_week
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        ...baseValues,
        ...extendedValues,
        round2(details?.flight_trips_per_year),
        ...mealValues,
      )
      .run();
    return;
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
  }

  try {
    await db
      .prepare(
        `INSERT INTO usage (
        username, date, elec_kwh, gas_m3, co2_kg,
        residential_co2_kg, transport_co2_kg, diet_co2_kg, annual_co2_kg,
        car_annual_co2_kg, public_transit_annual_co2_kg, flight_annual_co2_kg, diet_annual_co2_kg,
        car_pattern, public_transit_pattern, flight_pattern,
        beef_meals_per_week, pork_meals_per_week, chicken_meals_per_week, seafood_meals_per_week, plant_meals_per_week
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(...baseValues, ...extendedValues, ...mealValues)
      .run();
    return;
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
  }

  // 기존 D1 usage 스키마에서도 앱이 멈추지 않도록 총량만 저장합니다.
  // 교통·식단 세부값까지 DB에 저장하려면 migration을 먼저 적용하세요.
  await db
    .prepare(
      "INSERT INTO usage (username, date, elec_kwh, gas_m3, co2_kg) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(...baseValues)
    .run();
}

/** 2. 로그인 및 횟수 업데이트 (users 테이블) */
export async function loginUser(username: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("D1 데이터베이스가 바인딩되지 않았습니다.");

  const existingUser = await db
    .prepare("SELECT username, login_count FROM users WHERE username = ?")
    .bind(username)
    .first<{ username: string; login_count: number }>();

  if (existingUser) {
    await db
      .prepare(
        "UPDATE users SET login_count = login_count + 1 WHERE username = ?",
      )
      .bind(username)
      .run();
  } else {
    await db
      .prepare(
        "INSERT INTO users (username, login_count, points) VALUES (?, 1, 100)",
      )
      .bind(username)
      .run();
  }
}

/** 3. 포인트 업데이트 (users 테이블) */
export async function updateUserPoints(
  username: string,
  points: number,
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("D1 데이터베이스가 바인딩되지 않았습니다.");

  await db
    .prepare("UPDATE users SET points = points + ? WHERE username = ?")
    .bind(points, username)
    .run();
}

/** 4. 리더보드 가져오기 (users 테이블) */
export async function getLeaderboardViaApi(): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  const { results } = await db
    .prepare(
      "SELECT username, login_count, points FROM users ORDER BY points DESC",
    )
    .all();

  return results.map((row: any, index: number) => ({
    id: `user-${index}`,
    name: row.username,
    loginCount: row.login_count,
    points: row.points,
    carbonSaved: Math.floor(row.points / 50),
    streak: 1,
  }));
}

/** 5. 포인트 상세 내역 저장 (logs 테이블) */
export async function savePointLog(
  username: string,
  description: string,
  amount: number,
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dateStr =
    new Date().toLocaleDateString("ko-KR") +
    " " +
    new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  await db
    .prepare(
      "INSERT INTO logs (username, date, description, amount) VALUES (?, ?, ?, ?)",
    )
    .bind(username, dateStr, description, amount)
    .run();
}

/** 6. 포인트 상세 내역 불러오기 (logs 테이블) */
export async function getPointLogs(username: string): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  const { results } = await db
    .prepare(
      "SELECT date, description, amount FROM logs WHERE username = ? ORDER BY id ASC",
    )
    .bind(username)
    .all();

  return results
    .map((row: any, index: number) => ({
      id: `log-${index}`,
      date: row.date,
      description: row.description,
      amount: row.amount,
    }))
    .reverse();
}

/** 7. 전체 포인트 로그 리스트 조회 (logs 테이블) */
export async function getAllPointLogs(): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  const { results } = await db
    .prepare(
      "SELECT username, date, description, amount FROM logs ORDER BY id ASC",
    )
    .all();

  return results
    .map((row: any, index: number) => ({
      id: `log-${index}`,
      username: row.username,
      date: row.date,
      description: row.description,
      amount: row.amount,
    }))
    .reverse();
}

/** 8. 피드 게시글 전체 가져오기 (feed 테이블) */
export async function getFeedPostsViaApi(): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const { results } = await db
      .prepare(
        "SELECT id, author, title, body, imageDataUrl, createdAt, likedBy FROM feed WHERE id IS NOT NULL AND id != '' ORDER BY createdAt DESC LIMIT 50",
      )
      .all();

    return results.map((row: any) => ({
      id: row.id,
      author: row.author,
      title: row.title,
      body: row.body,
      imageDataUrl: row.imageDataUrl || undefined,
      createdAt: Number(row.createdAt) || Date.now(),
      likedBy: row.likedBy ? JSON.parse(row.likedBy) : [],
    }));
  } catch (e) {
    console.error("피드 데이터 조회 실패:", e);
    return [];
  }
}

/** 9. 피드 게시글 수정 (feed 테이블) */
export async function editFeedPostViaApi(
  postId: string,
  title: string,
  body: string,
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("D1 데이터베이스가 바인딩되지 않았습니다.");

  await db
    .prepare("UPDATE feed SET title = ?, body = ? WHERE id = ?")
    .bind(title, body, postId)
    .run();
}

/** 10. 피드 게시글 삭제 (feed 테이블) */
export async function deleteFeedPostViaApi(postId: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("D1 데이터베이스가 바인딩되지 않았습니다.");

  await db.prepare("DELETE FROM feed WHERE id = ?").bind(postId).run();
}

/** 11. 피드 게시글 저장 (feed 테이블) */
export async function saveFeedPostViaApi(post: any): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("D1 데이터베이스가 바인딩되지 않았습니다.");

  await db
    .prepare(
      "INSERT INTO feed (id, author, title, body, imageDataUrl, createdAt, likedBy) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      post.id,
      post.author,
      post.title,
      post.body,
      post.imageDataUrl || "",
      post.createdAt,
      JSON.stringify(post.likedBy || []),
    )
    .run();
}

/** 12. 피드 좋아요 상태 동기화 (feed 테이블) */
export async function updateFeedPostLikesViaApi(
  postId: string,
  likedBy: string[],
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("D1 데이터베이스가 바인딩되지 않았습니다.");

  await db
    .prepare("UPDATE feed SET likedBy = ? WHERE id = ?")
    .bind(JSON.stringify(likedBy), postId)
    .run();
}

/** 13. 상품 교환 주문 저장 (orders 테이블) */
export async function saveOrder(username: string, order: any): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("D1 데이터베이스가 바인딩되지 않았습니다.");

  await db
    .prepare(
      "INSERT INTO orders (id, username, itemId, itemName, cost, requestedAt, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      order.id,
      username,
      order.itemId,
      order.itemName,
      order.cost,
      new Date(order.requestedAt).toLocaleString("ko-KR"),
      order.status,
    )
    .run();
}

/** 14. 전체 주문 데이터 리스트 추출 (orders 테이블) */
export async function getAllOrders(): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  const { results } = await db
    .prepare(
      "SELECT id, username, itemId, itemName, cost, requestedAt, status FROM orders ORDER BY requestedAt ASC",
    )
    .all();

  return results
    .map((row: any) => ({
      id: row.id,
      username: row.username,
      itemId: row.itemId,
      itemName: row.itemName,
      cost: row.cost,
      requestedAt: row.requestedAt,
      status: row.status || "requested",
    }))
    .reverse();
}

/** 15. 주문 상태 업데이트어 (orders 테이블) */
export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("D1 데이터베이스가 바인딩되지 않았습니다.");

  await db
    .prepare("UPDATE orders SET status = ? WHERE id = ?")
    .bind(newStatus, orderId)
    .run();
}

/** 16. 보안 인프라 시스템 로그 저장 (server_logs 테이블) */
export async function saveSystemLog(
  action: string,
  ip: string,
  country: string,
  userAgent: string,
  clientHints: DeviceClientHints = {},
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dateStr = new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });
  const device = buildDeviceLabel(userAgent, clientHints);

  await db
    .prepare(
      "INSERT INTO server_logs (date, action, ip, country, device) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(dateStr, action, ip, country, device)
    .run();
}

/** 17. 보안 시스템 로그 어레이 반환 (server_logs 테이블) */
export async function getSystemLogs(): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  const { results } = await db
    .prepare(
      "SELECT id, date, action, ip, country, device FROM server_logs ORDER BY id DESC LIMIT 100",
    )
    .all();

  return results.map((row: any) => ({
    id: `syslog-${row.id}`,
    date: row.date,
    action: row.action,
    ip: row.ip,
    country: row.country,
    device: row.device,
  }));
}

/** 18. 사용자의 가스/전기/교통/식단 이력 조회 (usage 테이블) */
export async function getUsageHistory(username: string): Promise<UsageRow[]> {
  const db = getDb();
  if (!db) return [];

  const mapUsageRow = (
    row: any,
    options: { includeFlightTrips: boolean; includePublicTransitDistance: boolean },
  ): UsageRow => ({
    date: row.date,
    elec_kwh: Number(row.elec_kwh) || 0,
    gas_m3: Number(row.gas_m3) || 0,
    co2_kg: Number(row.co2_kg) || 0,
    residential_co2_kg: Number(row.residential_co2_kg) || 0,
    transport_co2_kg: Number(row.transport_co2_kg) || 0,
    diet_co2_kg: Number(row.diet_co2_kg) || 0,
    annual_co2_kg: Number(row.annual_co2_kg) || 0,
    car_annual_co2_kg: Number(row.car_annual_co2_kg) || 0,
    public_transit_annual_co2_kg: Number(row.public_transit_annual_co2_kg) || 0,
    flight_annual_co2_kg: Number(row.flight_annual_co2_kg) || 0,
    diet_annual_co2_kg: Number(row.diet_annual_co2_kg) || 0,
    car_pattern: row.car_pattern,
    public_transit_pattern: row.public_transit_pattern,
    ...(options.includePublicTransitDistance
      ? { public_transit_distance: row.public_transit_distance }
      : {}),
    flight_pattern: row.flight_pattern,
    ...(options.includeFlightTrips &&
    row.flight_trips_per_year !== null &&
    row.flight_trips_per_year !== undefined
      ? { flight_trips_per_year: Number(row.flight_trips_per_year) || 0 }
      : {}),
    beef_meals_per_week: Number(row.beef_meals_per_week) || 0,
    pork_meals_per_week: Number(row.pork_meals_per_week) || 0,
    chicken_meals_per_week: Number(row.chicken_meals_per_week) || 0,
    seafood_meals_per_week: Number(row.seafood_meals_per_week) || 0,
    plant_meals_per_week: Number(row.plant_meals_per_week) || 0,
  });

  try {
    const { results } = await db
      .prepare(
        `SELECT
        date, elec_kwh, gas_m3, co2_kg,
        residential_co2_kg, transport_co2_kg, diet_co2_kg, annual_co2_kg,
        car_annual_co2_kg, public_transit_annual_co2_kg, flight_annual_co2_kg, diet_annual_co2_kg,
        car_pattern, public_transit_pattern, public_transit_distance, flight_pattern, flight_trips_per_year,
        beef_meals_per_week, pork_meals_per_week, chicken_meals_per_week, seafood_meals_per_week, plant_meals_per_week
       FROM usage
       WHERE username = ?
       ORDER BY id ASC`,
      )
      .bind(username)
      .all();

    return results.map((row: any) =>
      mapUsageRow(row, {
        includeFlightTrips: true,
        includePublicTransitDistance: true,
      }),
    );
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
  }

  try {
    const { results } = await db
      .prepare(
        `SELECT
        date, elec_kwh, gas_m3, co2_kg,
        residential_co2_kg, transport_co2_kg, diet_co2_kg, annual_co2_kg,
        car_annual_co2_kg, public_transit_annual_co2_kg, flight_annual_co2_kg, diet_annual_co2_kg,
        car_pattern, public_transit_pattern, flight_pattern, flight_trips_per_year,
        beef_meals_per_week, pork_meals_per_week, chicken_meals_per_week, seafood_meals_per_week, plant_meals_per_week
       FROM usage
       WHERE username = ?
       ORDER BY id ASC`,
      )
      .bind(username)
      .all();

    return results.map((row: any) =>
      mapUsageRow(row, {
        includeFlightTrips: true,
        includePublicTransitDistance: false,
      }),
    );
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
  }

  try {
    const { results } = await db
      .prepare(
        `SELECT
        date, elec_kwh, gas_m3, co2_kg,
        residential_co2_kg, transport_co2_kg, diet_co2_kg, annual_co2_kg,
        car_annual_co2_kg, public_transit_annual_co2_kg, flight_annual_co2_kg, diet_annual_co2_kg,
        car_pattern, public_transit_pattern, flight_pattern,
        beef_meals_per_week, pork_meals_per_week, chicken_meals_per_week, seafood_meals_per_week, plant_meals_per_week
       FROM usage
       WHERE username = ?
       ORDER BY id ASC`,
      )
      .bind(username)
      .all();

    return results.map((row: any) =>
      mapUsageRow(row, {
        includeFlightTrips: false,
        includePublicTransitDistance: false,
      }),
    );
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
  }

  const { results } = await db
    .prepare(
      "SELECT date, elec_kwh, gas_m3, co2_kg FROM usage WHERE username = ? ORDER BY id ASC",
    )
    .bind(username)
    .all();

  return results.map((row: any) => ({
    date: row.date,
    elec_kwh: Number(row.elec_kwh) || 0,
    gas_m3: Number(row.gas_m3) || 0,
    co2_kg: Number(row.co2_kg) || 0,
  }));
}

/** 19. 친환경 인증 타임라인 라인업 추가 (certifications 테이블) */
export async function saveCertification(
  username: string,
  date: string,
  type: string,
  points: number,
  id: string,
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("D1 데이터베이스가 바인딩되지 않았습니다.");

  await db
    .prepare(
      "INSERT INTO certifications (id, username, date, type, points) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, username, date, type, points)
    .run();
}

/** 20. 친환경 인증 타임라인 컴포넌트 로드 (certifications 테이블) */
export async function getCertifications(username: string): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  const { results } = await db
    .prepare(
      "SELECT id, date, type, points FROM certifications WHERE username = ? ORDER BY date ASC",
    )
    .bind(username)
    .all();

  return results
    .map((row: any) => ({
      id: row.id,
      date: row.date,
      type: row.type,
      points: row.points,
    }))
    .reverse();
}

/**코칭 챗 단건 컨텍스트 기록 (coaching_chats 테이블) */
export async function saveChatMessage(
  username: string,
  role: string,
  content: string,
  id: string,
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("D1 데이터베이스가 바인딩되지 않았습니다.");

  const dateStr = new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });

  await db
    .prepare(
      "INSERT INTO coaching_chats (id, username, role, content, createdAt) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, username, role, content, dateStr)
    .run();
}

/** 22. 코칭 챗 히스토리 복원 로드 (coaching_chats 테이블) */
export async function getChatMessages(username: string): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  const { results } = await db
    .prepare(
      "SELECT id, role, content FROM coaching_chats WHERE username = ? ORDER BY createdAt ASC",
    )
    .bind(username)
    .all();

  return results.map((row: any) => ({
    id: row.id,
    role: row.role,
    content: row.content,
  }));
}

function assertAdminPassword(adminPassword?: string): void {
  const configuredPassword = String(
    (process.env as any).ADMIN_PASSWORD ||
      (process.env as any).NEXT_PUBLIC_ADMIN_PASSWORD ||
      "seoul1234",
  );

  if (!adminPassword || adminPassword !== configuredPassword) {
    throw new Error("관리자 인증이 필요합니다.");
  }
}

/** 23. 관리자: 서버 측 비밀번호 검증 */
export async function verifyAdminPassword(
  adminPassword: string,
): Promise<boolean> {
  assertAdminPassword(adminPassword);
  return true;
}

export type AdminUserSummary = {
  username: string;
  loginCount: number;
  points: number;
  usageCount: number;
  lastUsageDate: string | null;
  lastCo2Kg: number;
  totalCo2Kg: number;
  pointLogCount: number;
  certificationCount: number;
  orderCount: number;
  pendingOrderCount: number;
};

export type AdminUserDetail = {
  user: AdminUserSummary | null;
  pointLogs: Array<{ id: string; date: string; description: string; amount: number }>;
  usageHistory: UsageRow[];
  certifications: Array<{ id: string; date: string; type: string; points: number }>;
  orders: Array<{
    id: string;
    itemId: string;
    itemName: string;
    cost: number;
    requestedAt: string;
    status: string;
  }>;
};

const mapAdminUserSummary = (row: any): AdminUserSummary => ({
  username: String(row.username ?? ""),
  loginCount: Number(row.login_count ?? row.loginCount) || 0,
  points: Number(row.points) || 0,
  usageCount: Number(row.usage_count ?? row.usageCount) || 0,
  lastUsageDate: row.last_usage_date ?? row.lastUsageDate ?? null,
  lastCo2Kg: Number(row.last_co2_kg ?? row.lastCo2Kg) || 0,
  totalCo2Kg: Number(row.total_co2_kg ?? row.totalCo2Kg) || 0,
  pointLogCount: Number(row.point_log_count ?? row.pointLogCount) || 0,
  certificationCount: Number(row.certification_count ?? row.certificationCount) || 0,
  orderCount: Number(row.order_count ?? row.orderCount) || 0,
  pendingOrderCount: Number(row.pending_order_count ?? row.pendingOrderCount) || 0,
});

/** 24. 관리자: 전체 사용자 요약 조회 */
export async function getAdminUsers(
  adminPassword: string,
): Promise<AdminUserSummary[]> {
  assertAdminPassword(adminPassword);
  const db = getDb();
  if (!db) return [];

  const { results } = await db
    .prepare(
      `SELECT
        u.username,
        u.login_count,
        u.points,
        COALESCE((SELECT COUNT(*) FROM usage WHERE username = u.username), 0) AS usage_count,
        (SELECT date FROM usage WHERE username = u.username ORDER BY id DESC LIMIT 1) AS last_usage_date,
        COALESCE((SELECT co2_kg FROM usage WHERE username = u.username ORDER BY id DESC LIMIT 1), 0) AS last_co2_kg,
        COALESCE((SELECT ROUND(SUM(co2_kg), 2) FROM usage WHERE username = u.username), 0) AS total_co2_kg,
        COALESCE((SELECT COUNT(*) FROM logs WHERE username = u.username), 0) AS point_log_count,
        COALESCE((SELECT COUNT(*) FROM certifications WHERE username = u.username), 0) AS certification_count,
        COALESCE((SELECT COUNT(*) FROM orders WHERE username = u.username), 0) AS order_count,
        COALESCE((SELECT COUNT(*) FROM orders WHERE username = u.username AND status = 'requested'), 0) AS pending_order_count
       FROM users u
       ORDER BY u.points DESC, u.login_count DESC, u.username ASC`,
    )
    .all();

  return results.map(mapAdminUserSummary);
}

/** 25. 관리자: 사용자별 상세 정보 조회 */
export async function getAdminUserDetail(
  username: string,
  adminPassword: string,
): Promise<AdminUserDetail> {
  assertAdminPassword(adminPassword);
  const db = getDb();
  if (!db) {
    return {
      user: null,
      pointLogs: [],
      usageHistory: [],
      certifications: [],
      orders: [],
    };
  }

  const user = await db
    .prepare(
      `SELECT
        u.username,
        u.login_count,
        u.points,
        COALESCE((SELECT COUNT(*) FROM usage WHERE username = u.username), 0) AS usage_count,
        (SELECT date FROM usage WHERE username = u.username ORDER BY id DESC LIMIT 1) AS last_usage_date,
        COALESCE((SELECT co2_kg FROM usage WHERE username = u.username ORDER BY id DESC LIMIT 1), 0) AS last_co2_kg,
        COALESCE((SELECT ROUND(SUM(co2_kg), 2) FROM usage WHERE username = u.username), 0) AS total_co2_kg,
        COALESCE((SELECT COUNT(*) FROM logs WHERE username = u.username), 0) AS point_log_count,
        COALESCE((SELECT COUNT(*) FROM certifications WHERE username = u.username), 0) AS certification_count,
        COALESCE((SELECT COUNT(*) FROM orders WHERE username = u.username), 0) AS order_count,
        COALESCE((SELECT COUNT(*) FROM orders WHERE username = u.username AND status = 'requested'), 0) AS pending_order_count
       FROM users u
       WHERE u.username = ?`,
    )
    .bind(username)
    .first<any>();

  const [pointLogRows, usageRows, certificationRows, orderRows] = await Promise.all([
    db
      .prepare(
        "SELECT id, date, description, amount FROM logs WHERE username = ? ORDER BY id DESC LIMIT 20",
      )
      .bind(username)
      .all(),
    db
      .prepare(
        "SELECT date, elec_kwh, gas_m3, co2_kg FROM usage WHERE username = ? ORDER BY id DESC LIMIT 12",
      )
      .bind(username)
      .all(),
    db
      .prepare(
        "SELECT id, date, type, points FROM certifications WHERE username = ? ORDER BY date DESC LIMIT 12",
      )
      .bind(username)
      .all(),
    db
      .prepare(
        "SELECT id, itemId, itemName, cost, requestedAt, status FROM orders WHERE username = ? ORDER BY requestedAt DESC LIMIT 20",
      )
      .bind(username)
      .all(),
  ]);

  return {
    user: user ? mapAdminUserSummary(user) : null,
    pointLogs: pointLogRows.results.map((row: any) => ({
      id: `admin-log-${row.id}`,
      date: row.date,
      description: row.description,
      amount: Number(row.amount) || 0,
    })),
    usageHistory: usageRows.results.map((row: any) => ({
      date: row.date,
      elec_kwh: Number(row.elec_kwh) || 0,
      gas_m3: Number(row.gas_m3) || 0,
      co2_kg: Number(row.co2_kg) || 0,
    })),
    certifications: certificationRows.results.map((row: any) => ({
      id: row.id,
      date: row.date,
      type: row.type,
      points: Number(row.points) || 0,
    })),
    orders: orderRows.results.map((row: any) => ({
      id: row.id,
      itemId: row.itemId,
      itemName: row.itemName,
      cost: Number(row.cost) || 0,
      requestedAt: row.requestedAt,
      status: row.status || "requested",
    })),
  };
}

/** 26. 관리자: 포인트 지급/회수 */
export async function adjustUserPointsByAdmin(
  username: string,
  amount: number,
  reason: string,
  adminPassword: string,
): Promise<{ username: string; points: number }> {
  assertAdminPassword(adminPassword);
  const db = getDb();
  if (!db) throw new Error("D1 데이터베이스가 바인딩되지 않았습니다.");

  const target = username.trim();
  const delta = Math.trunc(Number(amount));
  const memo = reason.trim() || "관리자 수동 조정";

  if (!target) throw new Error("사용자명이 비어 있습니다.");
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("조정할 포인트는 0이 아닌 숫자여야 합니다.");
  }

  const existing = await db
    .prepare("SELECT username, points FROM users WHERE username = ?")
    .bind(target)
    .first<{ username: string; points: number }>();

  if (!existing) throw new Error("대상 사용자를 찾을 수 없습니다.");

  await db
    .prepare("UPDATE users SET points = MAX(points + ?, 0) WHERE username = ?")
    .bind(delta, target)
    .run();

  const updated = await db
    .prepare("SELECT username, points FROM users WHERE username = ?")
    .bind(target)
    .first<{ username: string; points: number }>();

  const dateStr =
    new Date().toLocaleDateString("ko-KR") +
    " " +
    new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  await db
    .prepare(
      "INSERT INTO logs (username, date, description, amount) VALUES (?, ?, ?, ?)",
    )
    .bind(target, dateStr, `[관리자] ${memo}`, delta)
    .run();

  return {
    username: target,
    points: Number(updated?.points) || 0,
  };
}

