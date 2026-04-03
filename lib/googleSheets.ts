"use server";

export type UsageRow = {
  username: string;
  date: string;
  elec_kwh: number;
  gas_m3: number;
  co2_kg: number;
};

// CO2 계산 함수
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

// ==========================================
// 🚀 Edge 호환용 경량화 JWT(토큰) 발급기
// ==========================================
function base64urlEncode(str: string) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlEncodeBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error("서버 환경 변수가 누락되었습니다.");
  }

  try {
    // 1. JWT 헤더(Header) 생성
    const header = { alg: "RS256", typ: "JWT" };
    // 2. JWT 페이로드(Payload) 생성
    const now = Math.floor(Date.now() / 1000);
    const claimSet = {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedClaimSet = base64urlEncode(JSON.stringify(claimSet));
    const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

    // 3. 비밀키 텍스트 정제 (헤더, 푸터, 줄바꿈 제거)
    const pemContents = privateKey
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\s/g, "");
      
    // 4. Web Crypto API를 사용한 서명 (가장 빠르고 가벼움)
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "pkcs8",
      binaryDer.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await globalThis.crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      new TextEncoder().encode(signatureInput)
    );

    const jwt = `${signatureInput}.${base64urlEncodeBuffer(signature)}`;

    // 5. 생성된 JWT를 구글에 보내 진짜 Access Token으로 교환
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`구글 토큰 발급 실패: ${errText}`);
    }

    const data = await res.json();
    return { token: data.access_token, spreadsheetId };
  } catch (err: any) {
    throw new Error(`인증 에러: ${err.message}`);
  }
}
// ==========================================

/** 데이터 저장 기능 */
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

  if (!response.ok) throw new Error("구글 시트 저장 실패");
}

/** 로그인 및 횟수 업데이트 */
export async function loginUser(username: string): Promise<void> {
  const { token, spreadsheetId } = await getAccessToken();
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/users!A:C`;
  
  const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
  const data = await getRes.json();
  const rows = data.values || [];

  let rowIndex = -1;
  let currentLogins = 0;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === username) {
      rowIndex = i + 1;
      currentLogins = Number(rows[i][1]) || 0;
      break;
    }
  }

  if (rowIndex !== -1) {
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/users!B${rowIndex}?valueInputOption=USER_ENTERED`;
    await fetch(updateUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[currentLogins + 1]] })
    });
  } else {
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/users!A:C:append?valueInputOption=USER_ENTERED`;
    await fetch(appendUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[username, 1, 0]] })
    });
  }
}

/** 포인트 업데이트 */
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
      body: JSON.stringify({ values: [[currentPoints + points]] })
    });
  }
}

/** 리더보드 가져오기 */
export async function getLeaderboardViaApi(): Promise<any[]> {
  try {
    const { token, spreadsheetId } = await getAccessToken();
    const range = encodeURIComponent("users!A:C");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error(`서버 응답 에러: ${response.status}`);

    const data = await response.json();
    const rows = data.values || [];
    
    if (rows.length <= 1) return [];

    // 데이터 파싱 로직 강화
    return rows.slice(1).map((row: any, index: number) => {
      const p = parseInt(row[2], 10) || 0; // 포인트 값을 명확히 숫자로 변환
      return {
        id: String(index + 1),
        name: row[0] || "이름 없음",
        loginCount: parseInt(row[1], 10) || 0,
        points: p,
        // page.tsx의 계산 방식(points / 50)과 통일하여 일관성 유지
        carbonSaved: Math.floor(p / 50), 
        streak: 1
      };
    }).sort((a: any, b: any) => b.points - a.points);
  } catch (error: any) {
    throw new Error(error.message);
  }
}
