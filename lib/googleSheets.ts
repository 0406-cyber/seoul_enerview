"use server";

import { GoogleAuth } from "google-auth-library";

export type UsageRow = {
  username: string;
  date: string;
  elec_kwh: number;
  gas_m3: number;
  co2_kg: number;
};

export async function computeCo2Kg(elecKwh: number, gasM3: number): Promise<number> {
  return elecKwh * 0.4781 + gasM3 * 2.176;
}

function todayYmd(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

async function getAccessToken() {
  console.log("🔐 [인증 시작] 환경 변수를 확인합니다...");
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    console.error("❌ [인증 실패] 필수 환경 변수(이메일, 키, 시트ID) 중 일부가 없습니다.");
    throw new Error("환경 변수 누락");
  }

  console.log("📡 [구글 인증] GoogleAuth 객체를 생성합니다.");
  try {
    const auth = new GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();
    console.log("✅ [인증 성공] 토큰 발급 완료");
    return { token: token.token, spreadsheetId };
  } catch (err: any) {
    console.error("💥 [인증 에러] 구글 인증 과정에서 에러 발생:", err.message);
    throw err;
  }
}

export async function saveUsage(username: string, elec: number, gas: number, co2: number): Promise<void> {
  console.log(`📝 [기록 시도] 유저: ${username}, 전기: ${elec}, 가스: ${gas}`);
  try {
    const { token, spreadsheetId } = await getAccessToken();
    const range = encodeURIComponent("usage!A:E");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;

    const values = [[username, todayYmd(), String(elec), String(gas), String(co2)]];

    console.log("📤 [데이터 전송] 구글 API로 POST 요청을 보냅니다.");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ [저장 실패] API 응답 에러: ${response.status} - ${errText}`);
      throw new Error(`저장 실패: ${errText}`);
    }
    console.log("🎉 [저장 완료] 구글 시트에 데이터가 성공적으로 기록되었습니다.");
  } catch (error: any) {
    console.error("💥 [최종 에러] saveUsage 실행 중 문제 발생:", error.message);
    throw error;
  }
}

// ... 나머지 loginUser, updateUserPoints, getLeaderboardViaApi 함수들도 
// 위와 같은 방식으로 중간에 console.log를 넣어두시면 좋습니다.
// (지면상 생략하지만, 기존 코드를 그대로 유지해도 작동에는 문제 없습니다.)

/** Google Sheets API를 호출하여 실시간 리더보드 데이터를 읽어옵니다. */
export async function getLeaderboardViaApi(): Promise<any[]> {
  try {
    console.log("📊 [리더보드] 데이터를 가져오는 중...");
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
    console.log(`✅ [리더보드 완료] ${rows.length}행 읽어옴`);
    
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
