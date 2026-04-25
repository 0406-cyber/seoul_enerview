"use client"

import { useState } from "react"
import { Leaf, ArrowRight, Sparkles, Loader2 } from "lucide-react"

interface OnboardingScreenProps {
  onComplete: (nickname: string) => void | Promise<void>
  checkIsExistingUser: (nickname: string) => Promise<boolean> // 기존 유저 확인 함수 추가
}

export function OnboardingScreen({ onComplete, checkIsExistingUser }: OnboardingScreenProps) {
  const [step, setStep] = useState(1)
  const [nickname, setNickname] = useState("")
  const [error, setError] = useState("")
  const [isChecking, setIsChecking] = useState(false) // 중복 확인 로딩 상태

  const handleSubmit = async () => {
    const trimmedName = nickname.trim()
    if (!trimmedName) {
      setError("닉네임을 입력해주세요")
      return
    }
    if (trimmedName.length < 2) {
      setError("닉네임은 2자 이상이어야 해요")
      return
    }
    if (trimmedName.length > 10) {
      setError("닉네임은 10자 이하여야 해요")
      return
    }
    
    setError("")
    setIsChecking(true)
    
    try {
      // 서버에서 기존 가입자인지 확인
      const isExisting = await checkIsExistingUser(trimmedName)
      
      if (isExisting) {
        // 기존 가입자라면 100P 화면(Step 2)을 건너뛰고 바로 완료
        onComplete(trimmedName)
      } else {
        // 신규 가입자만 환영 화면(Step 2)으로 이동
        setStep(2)
      }
    } catch (e) {
      // 에러 발생 시 안전하게 신규 가입 절차로 진행
      setStep(2)
    } finally {
      setIsChecking(false)
    }
  }

  const handleStart = () => {
    onComplete(nickname.trim())
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-40 right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto px-6 py-12 relative z-10">
        {step === 1 ? (
          <>
            <div className="text-center mb-12">
              <div className="w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center mx-auto mb-6">
                <Leaf className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">서울청년기획봉사단</h1>
              <p className="text-muted-foreground">탄소 절약 & AI 에너지 코칭</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  닉네임을 입력해주세요
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value)
                    setError("")
                  }}
                  disabled={isChecking}
                  onKeyDown={(e) => e.key === "Enter" && !isChecking && handleSubmit()}
                  placeholder="예: 에너지"
                  className="w-full h-14 px-5 bg-card border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50"
                  maxLength={10}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>

              <button
                onClick={handleSubmit}
                disabled={isChecking}
                className="w-full h-14 bg-primary text-primary-foreground font-semibold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-70"
              >
                {isChecking ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    다음
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>

            <div className="mt-12 space-y-3">
              <FeatureItem icon="chart" text="전기/가스 사용량 분석" />
              <FeatureItem icon="ai" text="AI 맞춤 에너지 코칭" />
              <FeatureItem icon="camera" text="친환경 활동 인증" />
              <FeatureItem icon="trophy" text="친구들과 랭킹 경쟁" />
            </div>
          </>
        ) : (
          <>
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-8 animate-bounce">
                <Sparkles className="w-12 h-12 text-primary" />
              </div>
              
              <h1 className="text-2xl font-bold text-foreground mb-2">
                환영해요, <span className="text-primary">{nickname}</span>님!
              </h1>
              <p className="text-muted-foreground mb-8">
                지구를 위한 작은 실천을 함께 시작해볼까요?
              </p>

              <div className="bg-card border border-border rounded-3xl p-6 mb-8">
                <p className="text-sm text-muted-foreground mb-2">시작 포인트</p>
                <p className="text-4xl font-bold text-primary">100P</p>
                <p className="text-xs text-muted-foreground mt-2">
                  친환경 활동을 인증하고 더 많은 포인트를 모아보세요!
                </p>
              </div>

              <button
                onClick={handleStart}
                className="w-full h-14 bg-primary text-primary-foreground font-semibold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                시작하기
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-center gap-2 pb-12">
        <div className={`w-2 h-2 rounded-full transition-colors ${step === 1 ? "bg-primary" : "bg-muted"}`} />
        <div className={`w-2 h-2 rounded-full transition-colors ${step === 2 ? "bg-primary" : "bg-muted"}`} />
      </div>
    </main>
  )
}

function FeatureItem({ icon, text }: { icon: "chart" | "ai" | "camera" | "trophy"; text: string }) {
  return (
    <div className="flex items-center gap-3 text-muted-foreground">
      <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center">
        {icon === "chart" && (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )}
        {icon === "ai" && (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
        {icon === "camera" && (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
        {icon === "trophy" && (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        )}
      </div>
      <span className="text-sm">{text}</span>
    </div>
  )
}
