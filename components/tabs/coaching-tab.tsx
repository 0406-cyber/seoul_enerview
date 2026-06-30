"use client"

import { useMemo, useState, useEffect, useRef } from "react" // 💡 useEffect와 useRef를 추가로 임포트했습니다.
import { Sparkles, Send, Bot, User, MessageCircle, Clock, Shield } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

interface CoachingTabProps {
  messages: Message[]
  onSendMessage: (message: string, nickname?: string) => void
  onRequestAdvice: () => void
  isLoading: boolean
  currentNickname?: string | null
}

export function CoachingTab({
  messages,
  onSendMessage,
  onRequestAdvice,
  isLoading,
  currentNickname,
}: CoachingTabProps) {
  const [input, setInput] = useState("")
  
  // 💡 스크롤 최하단 위치를 가리킬 참조(Ref) 객체를 생성합니다.
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const stats = useMemo(() => {
    const count = messages.length
    const last = messages.at(-1) ?? null
    const lastRole = last?.role ?? null
    const hasAssistant = messages.some((m) => m.role === "assistant")
    return { count, lastRole, hasAssistant }
  }, [messages])

  // 💡 메시지 내역이 변경되거나 로딩 상태가 바뀔 때마다 스크롤을 최하단으로 내립니다.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    onSendMessage(input.trim(), currentNickname?.trim() || undefined)
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* CTA / tips */}
        <div className="glass-morphism rounded-[2.5rem] p-8 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                AI Coaching
              </p>
              <h3 className="text-xl font-bold text-foreground">AI 에너지 코치</h3>
            </div>
            <div className="w-12 h-12 rounded-3xl bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
          </div>

          <button
            onClick={onRequestAdvice}
            disabled={isLoading}
            className="w-full bg-primary text-primary-foreground rounded-2xl py-4 text-base font-black transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 shadow-[0_20px_50px_rgba(74,222,128,0.25)] flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            내 사용량 기반 조언 듣기
          </button>

          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl px-5 py-4">
              “전기 320kWh, 가스 18m³인데 줄이는 방법 추천해줘”처럼 수치와 상황을 같이 써보세요.
            </div>
            <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl px-5 py-4">
              결과를 실행했다면 “실천 후기”를 남기면 다음 답변이 더 정확해져요.
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="glass-card rounded-[2.5rem] overflow-hidden border border-border flex flex-col h-[calc(100vh-260px)] md:h-[calc(100vh-310px)]">
          <div className="px-6 py-5 border-b border-border bg-background/60 backdrop-blur">
            <p className="text-sm font-bold text-foreground">대화</p>
            <p className="text-xs text-muted-foreground">
              {stats.lastRole === "user"
                ? "사용자 입력을 기반으로 답변을 만들고 있어요."
                : "질문을 남기면 바로 시작할 수 있어요."}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <div className="w-16 h-16 rounded-3xl bg-primary/20 flex items-center justify-center mb-4">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <p className="text-lg font-medium text-foreground mb-2">
                  AI 에너지 코치
                </p>
                <p className="text-sm">
                  에너지 절약에 대해 무엇이든 물어보세요!
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex items-end gap-2 max-w-[85%] ${
                    message.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      message.role === "user" ? "bg-primary/20" : "bg-secondary"
                    }`}
                  >
                    {message.role === "user" ? (
                      <User className="w-4 h-4 text-primary" />
                    ) : (
                      <Bot className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div
                    className={`rounded-3xl px-5 py-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-lg"
                        : "bg-card border border-border text-foreground rounded-bl-lg"
                    }`}
                  >
                    {message.role === "assistant" && message.content === "" ? (
                      <div className="flex gap-1 py-2">
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && messages.at(-1)?.content !== "" && (
              <div className="flex justify-start">
                <div className="flex items-end gap-2">
                  <div className="w-8 h-8 rounded-2xl bg-secondary flex items-center justify-center">
                    <Bot className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="bg-card border border-border rounded-3xl rounded-bl-lg px-5 py-4">
                    <div className="flex gap-1">
                      <span
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 💡 스크롤 트래킹용 더미 div 엘리먼트 추가 */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input dock */}
          <div className="p-4 bg-background border-t border-border">
            <div className="flex items-center gap-3 bg-card rounded-3xl p-2 border border-border">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요..."
                className="flex-1 bg-transparent px-4 py-2 text-foreground placeholder:text-muted-foreground outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

