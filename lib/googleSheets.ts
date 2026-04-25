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

function safeNum(val: any): number {
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 안전하게 정수로 변환하는 헬퍼 함수 (NaN 방지)
function safeParseInt(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

// 안전하게 소수로 변환하는 헬퍼 함수 (NaN 방지)
function safeParseFloat(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
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
  try {
    const { token, spreadsheetId } = await getAccessToken();
    const range = encodeURIComponent("usage!A:E");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;

    // 숫자를 문자열로 안전하게 변환하여 전송
    const values = [[
      username, 
      todayYmd(), 
      String(safeNum(elec)), 
      String(safeNum(gas)), 
      String(safeNum(co2.toFixed(2)))
    ]];

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    });

    if (!response.ok) {
      const errorDetail = await response.text();
      throw new Error(`시트 저장 실패: ${errorDetail}`);
    }
  } catch (err: any) {
    console.error("saveUsage 에러 상세:", err.message);
    throw err;
  }
}

// lib/googleSheets.ts 내부의 해당 함수들을 찾아 아래 내용으로 변경하세요.

/** 로그인 및 횟수 업데이트 */
export async function loginUser(username: string): Promise<void> {
  const { token, spreadsheetId } = await getAccessToken();
  // 캐시 방지를 위해 끝에 타임스탬프 추가
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/users!A:C?t=${Date.now()}`;
  
  const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` }});
  const data = await getRes.json();
  const rows = data.values || [];

  let rowIndex = -1;
  let currentLogins = 0;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === username) {
      rowIndex = i + 1;
      currentLogins = safeParseInt(rows[i][1]); 
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
      // 🚨 신규 가입자 초기 포인트 100 적용! (기존 0 -> 100)
      body: JSON.stringify({ values: [[username, 1, 100]] }) 
    });
  }
}
/** 포인트 업데이트 */
/** 포인트 업데이트 로직 보강 */
/** 포인트 업데이트 */
export async function updateUserPoints(username: string, points: number): Promise<void> {
  const { token, spreadsheetId } = await getAccessToken();
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/users!A:C?t=${Date.now()}`; // 캐시 방지
  
  const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` }});
  const data = await getRes.json();
  const rows = data.values || [];

  let rowIndex = -1;
  let currentPoints = 0;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === username) {
      rowIndex = i + 1;
      currentPoints = safeParseInt(rows[i][2]);
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
    // 캐시를 완벽하게 무효화하는 타임스탬프 쿼리
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?t=${Date.now()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error(`서버 응답 에러: ${response.status}`);

    const data = await response.json();
    const rows = data.values || [];
    
    if (rows.length <= 1) return [];

    return rows.slice(1).map((row: any, index: number) => {
      const p = safeParseInt(row[2]);
      const logins = safeParseInt(row[1]);

      return {
        id: `user-${index}`,
        name: row[0] || "이름 없음",
        loginCount: logins,
        points: p,
        carbonSaved: Math.floor(p / 50),
        streak: 1
      };
    }).sort((a: any, b: any) => b.points - a.points);
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/** 포인트 상세 내역 저장 (logs 탭) */
export async function savePointLog(username: string, description: string, amount: number): Promise<void> {
  const { token, spreadsheetId } = await getAccessToken();
  const range = encodeURIComponent("logs!A:D");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;

  const dateStr = new Date().toLocaleDateString("ko-KR") + " " + new Date().toLocaleTimeString("ko-KR", {hour: '2-digit', minute:'2-digit'});
  const values = [[username, dateStr, description, String(amount)]];

  await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
}

/** 포인트 상세 내역 불러오기 (logs 탭) */
export async function getPointLogs(username: string): Promise<any[]> {
  try {
    const { token, spreadsheetId } = await getAccessToken();
    const range = encodeURIComponent("logs!A:D");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?t=${Date.now()}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "cache": "no-store" } });
    const data = await res.json();
    const rows = data.values || [];
    if (rows.length <= 1) return [];

    return rows.slice(1)
      .filter((row: any) => row[0] === username)
      .map((row: any, index: number) => ({
        id: `log-${index}`,
        date: row[1] || "",
        description: row[2] || "",
        amount: parseInt(row[3], 10) || 0
      })).reverse(); // 최신순 정렬
  } catch (e) {
    return [];
  }
}

/** 피드(시민기자단) 전체 불러오기 (feed 탭) */
/** 피드(시민기자단) 전체 불러오기 (feed 탭) */
export async function getFeedPostsViaApi(): Promise<any[]> {
  try {
    const { token, spreadsheetId } = await getAccessToken();
    const range = encodeURIComponent("feed!A:G");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?t=${Date.now()}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "cache": "no-store" } });
    const data = await res.json();
    const rows = data.values || [];
    if (rows.length <= 1) return [];

    return rows.slice(1)
      .filter((row: any) => row[0] && String(row[0]).trim() !== "") // ⭐️ 삭제되어 빈칸이 된 행 필터링
      .map((row: any) => ({
        id: row[0],
        author: row[1],
        title: row[2],
        body: row[3],
        imageDataUrl: row[4] || undefined,
        createdAt: Number(row[5]) || Date.now(),
        likedBy: row[6] ? JSON.parse(row[6]) : []
      })).reverse();
  } catch (e) {
    return [];
  }
}

/** 피드 수정하기 (feed 탭) */
export async function editFeedPostViaApi(postId: string, title: string, body: string): Promise<void> {
  const { token, spreadsheetId } = await getAccessToken();
  const range = encodeURIComponent("feed!A:G");
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?t=${Date.now()}`;
  const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}`, "cache": "no-store" } });
  const data = await getRes.json();
  const rows = data.values || [];

  let rowIndex = -1;
  for(let i = 0; i < rows.length; i++) {
    if(rows[i][0] === postId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex !== -1) {
    // C열(제목)과 D열(내용)만 덮어쓰기
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/feed!C${rowIndex}:D${rowIndex}?valueInputOption=USER_ENTERED`;
    await fetch(updateUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[title, body]] })
    });
  }
}

/** 피드 삭제하기 (feed 탭) */
export async function deleteFeedPostViaApi(postId: string): Promise<void> {
  const { token, spreadsheetId } = await getAccessToken();
  const range = encodeURIComponent("feed!A:G");
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?t=${Date.now()}`;
  const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}`, "cache": "no-store" } });
  const data = await getRes.json();
  const rows = data.values || [];

  let rowIndex = -1;
  for(let i = 0; i < rows.length; i++) {
    if(rows[i][0] === postId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex !== -1) {
    // 해당 행을 모두 빈칸으로 덮어써서 삭제 처리
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/feed!A${rowIndex}:G${rowIndex}?valueInputOption=USER_ENTERED`;
    await fetch(updateUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [["", "", "", "", "", "", ""]] }) 
    });
  }
}

/** 피드 작성하기 (feed 탭) */
export async function saveFeedPostViaApi(post: any): Promise<void> {
  const { token, spreadsheetId } = await getAccessToken();
  const range = encodeURIComponent("feed!A:G");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;

  const values = [[
    post.id,
    post.author,
    post.title,
    post.body,
    post.imageDataUrl || "",
    String(post.createdAt),
    JSON.stringify(post.likedBy || [])
  ]];

  await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
}

/** 피드 좋아요 업데이트 (feed 탭) */
export async function updateFeedPostLikesViaApi(postId: string, likedBy: string[]): Promise<void> {
  const { token, spreadsheetId } = await getAccessToken();
  const range = encodeURIComponent("feed!A:G");
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?t=${Date.now()}`;
  const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}`, "cache": "no-store" } });
  const data = await getRes.json();
  const rows = data.values || [];

  let rowIndex = -1;
  for(let i = 0; i < rows.length; i++) {
    if(rows[i][0] === postId) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex !== -1) {
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/feed!G${rowIndex}?valueInputOption=USER_ENTERED`;
    await fetch(updateUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[JSON.stringify(likedBy)]] })
    });
  }
}
/** 전체 포인트 내역 불러오기 (Admin 용) */
export async function getAllPointLogs(): Promise<any[]> {
  try {
    const { token, spreadsheetId } = await getAccessToken();
    const range = encodeURIComponent("logs!A:D");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?t=${Date.now()}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "cache": "no-store" } });
    const data = await res.json();
    const rows = data.values || [];
    if (rows.length <= 1) return [];

    return rows.slice(1)
      .map((row: any, index: number) => ({
        id: `log-${index}`,
        username: row[0] || "알 수 없음", // 첫 번째 열인 사용자 이름을 포함
        date: row[1] || "",
        description: row[2] || "",
        amount: parseInt(row[3], 10) || 0
      })).reverse(); // 최신순 정렬
  } catch (e) {
    return [];
  }
}
