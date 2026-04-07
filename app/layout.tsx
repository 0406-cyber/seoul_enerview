export const runtime = "edge";
export const dynamic = 'force-dynamic';

import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import Script from 'next/script' // ✨ 구글 애널리틱스를 위한 Script 컴포넌트 추가
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: '서울기획봉사단',
  description: '전기와 가스 사용량을 분석하고 AI 쳇봇을 통해 탄소 배출을 줄여보세요',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#121212',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased bg-background text-foreground">
        
        {/* ✨ 구글 애널리틱스 (Google Analytics) 태그 시작 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-HKH246CX9C"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-HKH246CX9C');
          `}
        </Script>
        {/* ✨ 구글 애널리틱스 (Google Analytics) 태그 끝 */}

        {children}
        <Toaster richColors position="top-center" />
        <Analytics />
      </body>
    </html>
  )
}
