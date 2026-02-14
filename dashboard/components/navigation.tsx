'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Sparkles, TrendingUp, Wallet, DollarSign, Settings, Building2, ChevronDown } from 'lucide-react'
import { ConnectButton } from './connect-button'
import { cn } from '@/lib/utils'
import { usePropertyContext } from '@/lib/property-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

const navItems = [
  { name: 'Overview', href: '/', icon: Home },
  { name: 'Invest', href: '/invest', icon: DollarSign },
  { name: 'AI Recommendations', href: '/recommendations', icon: Sparkles },
  { name: 'Yield Dashboard', href: '/yields', icon: TrendingUp },
  { name: 'My Portfolio', href: '/portfolio', icon: Wallet },
  { name: 'Management', href: '/management', icon: Settings },
]

export function Navigation() {
  const pathname = usePathname()
  const { properties, selectedPropertyId, setSelectedPropertyId, selectedProperty } = usePropertyContext()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="font-serif text-lg font-bold">Y</span>
            </div>
            <span className="font-serif text-xl font-semibold tracking-tight">YieldProp</span>
          </Link>
          {properties.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  {selectedProperty?.name ?? selectedPropertyId}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {properties.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => setSelectedPropertyId(p.id)}
                  >
                    {p.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <ConnectButton />
      </div>
    </header>
  )
}
