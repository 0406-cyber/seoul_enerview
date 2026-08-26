"use client"

import { TAB_META, MAIN_TAB_IDS, HIDDEN_USER_TAB_IDS } from "@/lib/tab-meta"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

interface MoreTabsSheetProps {
  activeTab: string
  onTabChange: (tab: string) => void
  children: React.ReactNode
}

export function MoreTabsSheet({ activeTab, onTabChange, children }: MoreTabsSheetProps) {
  const subTabs = TAB_META.filter((tab) => !MAIN_TAB_IDS.includes(tab.id) && !HIDDEN_USER_TAB_IDS.includes(tab.id))

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-[2rem] px-4 pb-8 pt-6">
        <SheetHeader className="px-0 pb-2">
          <SheetTitle className="text-center text-base font-bold">더 많은 기능</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-4 gap-3 pt-4">
          {subTabs.map((tab) => {
            const Icon = tab.Icon
            const isActive = activeTab === tab.id

            return (
              <SheetTrigger asChild key={tab.id}>
                <button
                  onClick={() => onTabChange(tab.id)}
                  className={`
                    flex flex-col items-center justify-center gap-2 rounded-2xl p-4 transition-all duration-300
                    ${isActive
                      ? "bg-primary text-primary-foreground shadow-lg scale-105"
                      : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }
                  `}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-[11px] font-bold whitespace-nowrap">{tab.navLabel}</span>
                </button>
              </SheetTrigger>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function getSubTabs() {
  return TAB_META.filter((tab) => !MAIN_TAB_IDS.includes(tab.id) && !HIDDEN_USER_TAB_IDS.includes(tab.id))
}