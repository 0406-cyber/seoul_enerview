import { GoogleGenAI } from "@google/genai";
import { getRequestContext } from '@cloudflare/next-on-pages'; 
const GEMMA_MODELS = [
  "gemma-4-31b-it",     
  "gemma-4-26b-a4b-it", 
];

const GEMINI_VISION_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash"
];

let aiInstance: any = null;

function getAI() {
  if (!aiInstance) {
    let key = undefined;
    
    try {
      const context = getRequestContext();
      if (context && context.env) {
        key = context.env.GEMINI_API_KEY || context.env.NEXT_PUBLIC_GEMINI_API_KEY;
      }
    } catch (e) {
      // 빌드 타임 컴파일 예외 방어
    }
    
    if (!key) {
      key = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    }
    
    if (!key) {
      console.error("⚠️ Gemini API Key가 설정되지 않았습니다.");
      return null;
    }
    
    aiInstance = new GoogleGenAI({ apiKey: key });
  }
  return aiInstance;
}

/**
 * 텍스트 API 호출 (Fallback 포함)
 */
export async function callTextApiWithFallback(
  prompt: string,
  models: string[] = GEMMA_MODELS,
  systemInstruction: string = "너는 친절한 AI 어시스턴트야. 생각 과정은 생략하고 한국어로 최종 답변만 해줘."
): Promise<string> {
  const ai = getAI();
  if (!ai) return "⚠️ API 키 설정 오류 (환경 변수를 확인하세요)";

  let lastErrorDetails = "알 수 없는 오류";

  for (const modelName of models) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        systemInstruction: systemInstruction,
        contents: prompt,
        config: {
          temperature: 0.6,
        }
      });

      if (response && response.text) {
        return response.text.trim();
      }
    } catch (error: any) {
      lastErrorDetails = `[${modelName} 예외 발생] ${error.message}`;
      continue;
    }
  }

  return `⚠️ AI 호출 실패 원인:\n\n${lastErrorDetails}`;
}

export async function getGemmaAdvice(elec: number, gas: number, co2: number): Promise<string> {
  const prompt = `사용자가 이번 달에 전기 ${elec}kWh, 가스 ${gas}m3를 사용하여 총 ${co2.toFixed(2)}kg의 탄소를 배출했어. 이 사용자에게 에너지 절약을 독려하고 실생활에서 실천할 수 있는 팁을 친절하게 한국어로 조언해줘.`;
  const systemInstruction = "너는 에너지 절약 전문가야. 분석과 따뜻한 조언을 한국어로만 짧게 말해줘.";
  return callTextApiWithFallback(prompt, GEMMA_MODELS, systemInstruction);
}

export async function askGemmaCustomQuestion(userMessage: string): Promise<string> {
  const systemInstruction = "너는 친구 같은 AI야. 사용자의 말에 대한 최종 답변만 한국어로 친절하게 짧게 대답해.";
  return callTextApiWithFallback(userMessage, GEMMA_MODELS, systemInstruction);
}

export type ImageAnalysisResult = {
  action_found?: string;
  description?: string;
  estimated_save_kwh?: string;
} | null;

export async function analyzeImageWithGemini(
  dataUrl: string,
  mimeTypeHint?: string
): Promise<{ result: ImageAnalysisResult; error: string | null }> {
  const ai = getAI();
  if (!ai) return { result: null, error: "API 키 설정 오류" };

  let lastErrorDetails = ""; 
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return { result: null, error: "이미지 데이터 형식이 올바르지 않습니다." };

  const mimeType = mimeTypeHint || match[1] || "image/jpeg";
  const encodedImage = match[2];

  for (const modelName of GEMINI_VISION_MODELS) {
    try {
      const prompt = `이미지를 분석해서 에너지 절약 행동을 파악해 주세요.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { data: encodedImage, mimeType } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              action_found: { type: "STRING" },
              description: { type: "STRING" },
              estimated_save_kwh: { type: "STRING" }
            },
            required: ["action_found", "description", "estimated_save_kwh"]
          }
        }
      });

      if (response && response.text) {
        const parsed = JSON.parse(response.text) as ImageAnalysisResult;
        return { result: parsed, error: null };
      }
    } catch (error: any) {
      lastErrorDetails = `[${modelName} 예외 발생] ${error.message}`;
      continue;
    }
  }
  return { result: null, error: `상세 에러: ${lastErrorDetails}` };
}

/**
 * 멀티턴 대화 내역을 포함하여 스트리밍 방식으로 답변을 반환
 * - 직접 채팅으로 들어온 메시지도 현재 로그인 닉네임을 함께 전달할 수 있게 username 옵션을 추가했습니다.
 * - Function Calling 응답은 원 스트림을 끝까지 소비한 뒤 다음 sendMessageStream으로 전송합니다.
 */
type ChatHistory = { role: "user" | "model"; parts: { text: string }[] }[];
type StreamChatOptions = {
  modelName?: string;
  username?: string | null;
};

type EnerviewFunctionCall = {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
};

function normalizeUsername(username?: string | null) {
  return typeof username === "string" ? username.trim() : "";
}

function buildMessageWithUserContext(message: string, username: string) {
  if (!username) return message;

  return [
    `[앱 컨텍스트] 현재 로그인 사용자 닉네임: ${username}`,
    `사용량/포인트/과거 기록 조회가 필요하면 사용자에게 닉네임을 다시 묻지 말고, 함수 호출 username 인자로 반드시 "${username}"를 사용하세요.`,
    "",
    `[사용자 메시지]\n${message}`,
  ].join("\n");
}

async function executeEnerviewTool(
  call: EnerviewFunctionCall,
  fallbackUsername: string,
) {
  const args = (call.args ?? {}) as Record<string, unknown>;
  const argUsername = typeof args.username === "string" ? args.username.trim() : "";
  const targetUser = argUsername || fallbackUsername;

  if (!targetUser) {
    return {
      ok: false,
      error:
        "닉네임이 전달되지 않아 조회할 수 없습니다. 클라이언트에서 username/nickname을 API 요청 body에 포함해 주세요.",
    };
  }

  try {
    if (call.name === "getUsageHistory") {
      const { getUsageHistory } = await import("./db");
      const result = await getUsageHistory(targetUser);
      return { ok: true, username: targetUser, result: result ?? null };
    }

    if (call.name === "getPointLogs") {
      const { getPointLogs } = await import("./db");
      const result = await getPointLogs(targetUser);
      return { ok: true, username: targetUser, result: result ?? null };
    }

    return {
      ok: false,
      username: targetUser,
      error: `지원하지 않는 함수 호출입니다: ${call.name ?? "unknown"}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      username: targetUser,
      error: err?.message ?? "데이터 조회 중 알 수 없는 오류가 발생했습니다.",
    };
  }
}

export async function* streamChatWithMessage(
  message: string,
  history: ChatHistory = [],
  modelNameOrOptions: string | StreamChatOptions = "gemini-3-flash-preview",
  usernameArg?: string | null,
) {
  const ai = getAI();
  if (!ai) throw new Error("⚠️ Gemini API Key가 설정되지 않았습니다.");

  const modelName =
    typeof modelNameOrOptions === "string"
      ? modelNameOrOptions
      : modelNameOrOptions.modelName ?? "gemini-3-flash-preview";

  const username = normalizeUsername(
    typeof modelNameOrOptions === "string"
      ? usernameArg
      : modelNameOrOptions.username,
  );

  const enerviewTools = [
    {
      functionDeclarations: [
        {
          name: "getUsageHistory",
          description:
            "사용자의 과거 전기 사용량, 가스 사용량, 주거/교통/식단 탄소 배출량, 교통수단·비행·식단 세부 입력 이력을 데이터베이스에서 직접 조회합니다.",
          parameters: {
            type: "OBJECT",
            properties: {
              username: {
                type: "STRING",
                description:
                  "조회할 대상 사용자의 닉네임. 앱 컨텍스트에 현재 로그인 사용자 닉네임이 있으면 그 값을 사용합니다.",
              },
            },
            required: ["username"],
          },
        },
        {
          name: "getPointLogs",
          description:
            "사용자가 에너뷰 앱 내에서 획득하거나 사용한 포인트 내역 히스토리를 조회합니다.",
          parameters: {
            type: "OBJECT",
            properties: {
              username: {
                type: "STRING",
                description:
                  "포인트를 조회할 대상 사용자의 닉네임. 앱 컨텍스트에 현재 로그인 사용자 닉네임이 있으면 그 값을 사용합니다.",
              },
            },
            required: ["username"],
          },
        },
      ],
    },
  ];

  const chat = ai.chats.create({
    model: modelName,
    history,
    config: {
      tools: enerviewTools,
      systemInstruction:
        "너는 친환경 에너지 가이드 에너뷰(Enerview) 코치야. 사용량 기반 조언 요청에는 전달된 전기·가스·주거·교통·식단·최근 추세 수치를 우선 근거로 삼고, 배출 비중이 큰 항목부터 실행 가능한 감축 행동을 제안해줘. 앱 컨텍스트에 현재 로그인 사용자 닉네임이 있으면 닉네임을 다시 묻지 말고 해당 닉네임으로 데이터 조회 함수를 호출해. 모든 답변은 따뜻한 한국어로 해줘.",
    },
  });

  let nextMessage: string | any[] = buildMessageWithUserContext(message, username);

  // 함수 호출이 연쇄적으로 발생할 수 있으므로 최대 4회까지만 순환합니다.
  for (let depth = 0; depth < 4; depth += 1) {
    const stream = await chat.sendMessageStream({ message: nextMessage as any });
    const pendingFunctionCalls: EnerviewFunctionCall[] = [];

    // 중요: follow-up 메시지를 보내기 전에 현재 스트림을 끝까지 소비합니다.
    for await (const chunk of stream) {
      if (chunk.functionCalls?.length) {
        pendingFunctionCalls.push(...(chunk.functionCalls as EnerviewFunctionCall[]));
      }

      if (chunk.text) {
        yield chunk.text;
      }
    }

    if (pendingFunctionCalls.length === 0) {
      return;
    }

    nextMessage = [];
    for (const call of pendingFunctionCalls) {
      const toolResult = await executeEnerviewTool(call, username);

      nextMessage.push({
        functionResponse: {
          id: call.id,
          name: call.name,
          response: toolResult,
        },
      });
    }
  }

  yield "\n⚠️ 함수 호출이 반복되어 응답 생성을 중단했습니다. 서버 로그에서 functionCalls 순환 여부를 확인해 주세요.";
}
