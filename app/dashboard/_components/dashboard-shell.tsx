'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Flame, Users, ClipboardList, Zap, BarChart3, LayoutDashboard, Trophy, Sparkles, BookOpen, Menu, X, LogOut, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/members', label: 'Members', icon: Users },
  { href: '/dashboard/assessment', label: '1 · Assessment', icon: ClipboardList },
  { href: '/dashboard/warmup', label: '2 · Warm-Up', icon: Zap },
  { href: '/dashboard/performance', label: '3 · Tracking', icon: BarChart3 },
  { href: '/dashboard/forge-games', label: '4 · Forge Games', icon: Trophy },
  { href: '/dashboard/library', label: '6A · Exercise Library', icon: BookOpen },
  { href: '/dashboard/generator', label: '6B · Program Generator', icon: Sparkles },
]

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname?.startsWith(href)
  }

  const Nav = () => (
    <nav className="flex-1 space-y-2">
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-colors min-h-[52px]',
              isActive(item.href) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="w-5 h-5" />
            {item.label}
            {isActive(item.href) && <ChevronRight className="w-4 h-4 ml-auto" />}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="lg:hidden sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-lg">La Forge MVP</span>
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="w-80 h-full bg-card p-6 flex flex-col" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Flame className="w-7 h-7 text-primary" />
                <span className="font-display font-bold text-xl">La Forge MVP</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <Nav />

            <Button variant="ghost" className="mt-4 justify-start text-muted-foreground min-h-[48px]" onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>
      )}

      <div className="flex">
        <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 border-r border-border bg-card/60">
          <div className="flex flex-col flex-1 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-7 h-7 text-primary" />
              <span className="font-display font-bold text-xl">La Forge MVP</span>
            </div>
            <p className="text-xs text-muted-foreground mb-8">Coach tool • iPad-first • Capacity target: 160 members</p>

            <Nav />

            <Button variant="ghost" className="justify-start text-muted-foreground min-h-[48px]" onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </aside>

        <main className="flex-1 lg:ml-72">
          <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
