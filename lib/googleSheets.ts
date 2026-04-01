"use server"; // [중요] 이 파일의 모든 함수는 서버에서만 실행되어 비밀키를 안전하게 보호합니다.

import { GoogleAuth } from "google-auth-library";

export type UsageRow = {
  username: string;
  date: string;
  elec_kwh: number;
  gas_m3: number;
  co2_kg: number;
};

// ⭕ 수정 후 (async와 Promise 추가)
export async function computeCo2Kg(elecKwh: number, gasM3: number): Promise<number> {
  return elecKwh * 0.4781 + gasM3 * 2.176;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** * 서비스 계정 JSON 키를 사용하여 안전하게 액세스 토큰을 발급받습니다.
 * 발급된 토큰은 라이브러리가 알아서 캐싱 및 갱신(Refresh)합니다.
 */
async function getAccessToken() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // .env 파일에서 읽어올 때 문자열로 처리된 \n 기호를 실제 줄바꿈 문자로 변환합니다.
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error("환경 변수에 구글 서비스 계정 정보 또는 시트 ID가 없습니다.");
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  if (!token.token) {
    throw new Error("구글 액세스 토큰을 가져오지 못했습니다.");
  }

  return { token: token.token, spreadsheetId };
}

/** app.py save_usage: usage 시트에 데이터 추가 */
export async function saveUsage(username: string, elec: number, gas: number, co2: number): Promise<void> {
  const { token, spreadsheetId } = await getAccessToken();
  const range = encodeURIComponent("usage!A:E");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;

  const values = [[username, todayYmd(), String(elec), String(gas), String(co2)]];

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Usage 저장 실패: ${err}`);
  }
}

/** app.py login_user: users 시트 검색 후 횟수 증가 또는 신규 추가 */
export async function loginUser(username: string): Promise<void> {
  const { token, spreadsheetId } = await getAccessToken();
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/users!A:C`;
  
  // 1. 기존 유저 검색
  const getRes = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await getRes.json();
  const rows = data.values || [];

  let rowIndex = -1;
  let currentLogins = 0;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === username) {
      rowIndex = i + 1; // 구글 시트는 1번 줄부터 시작하므로 +1
      currentLogins = Number(rows[i][1]) || 0;
      break;
    }
  }

  if (rowIndex !== -1) {
    // 2-A. 유저가 존재하면 로그인 횟수 1 증가 (PUT)
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/users!B${rowIndex}?valueInputOption=USER_ENTERED`;
    await fetch(updateUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[currentLogins + 1]] })
    });
  } else {
    // 2-B. 신규 유저면 새 행 추가 (POST)
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/users!A:C:append?valueInputOption=USER_ENTERED`;
    await fetch(appendUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[username, 1, 0]] })
    });
  }
}

/** app.py update_user_points: 유저 검색 후 포인트 증가 */
export async function updateUserPoints(username: string, points: number): Promise<void> {
  const { token, spreadsheetId } = await getAccessToken();
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/users!A:C`;
  
  const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
  const data = await getRes.json();
  const rows = data.values || [];

  let rowIndex = -1;
  let currentPoints = 0;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === username) {
      rowIndex = i + 1;
      currentPoints = Number(rows[i][2]) || 0;
      break;
    }
  }

  if (rowIndex !== -1) {
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/users!C${rowIndex}?valueInputOption=USER_ENTERED`;
    await fetch(updateUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[currentPoints + points]] }) // 합산된 수치 기록
    });
  }
}

/** Google Sheets API를 호출하여 실시간 리더보드 데이터를 읽어옵니다. */
export async function getLeaderboardViaApi(): Promise<any[]> {
  try {
    const { token, spreadsheetId } = await getAccessToken();
    const range = encodeURIComponent("users!A:C");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("시트 데이터 읽기 실패:", err);
      return [];
    }

    const data = await response.json();
    const rows = data.values || [];
    
    // 헤더(1번째 줄) 제외
    if (rows.length <= 1) return [];
    const actualData = rows.slice(1);

    return actualData.map((row: any, index: number) => ({
      id: String(index + 1),
      name: row[0] || "이름 없음",
      loginCount: Number(row[1]) || 0,
      points: Number(row[2]) || 0,
      carbonSaved: Math.floor(Number(row[2]) / 10) || 0, 
      streak: 0
    })).sort((a: any, b: any) => b.points - a.points);

  } catch (error) {
    console.error("네트워크/인증 에러:", error);
    return [];
  }
}
