// app/api/chat/route.ts
import { streamChatWithMessage } from '@/lib/gemini';

// 스트리밍을 위해 Edge 런타임 사용을 권장합니다.
export const runtime = 'edge';

type ChatHistory = { role: 'user' | 'model'; parts: { text: string }[] }[];

const json = (data: unknown, init?: ResponseInit) => {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
};

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeHistory = (value: unknown): ChatHistory =>
  Array.isArray(value) ? (value as ChatHistory) : [];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = normalizeText(body?.message);
    const history = normalizeHistory(body?.history);

    // page.tsx에서는 nickname으로 보내고, 향후 호환성을 위해 username도 허용합니다.
    const username = normalizeText(body?.nickname) || normalizeText(body?.username);

    if (!message) {
      return json({ error: '메시지가 필요합니다.' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const generator = streamChatWithMessage(message, history, { username });

          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(chunk));
          }

          controller.close();
        } catch (error) {
          console.error('스트리밍 에러:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (error) {
    console.error('API 라우트 처리 에러:', error);
    return json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
