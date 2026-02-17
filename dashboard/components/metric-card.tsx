
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface MetricCardProps {
    title: string
    value: string | number | undefined
    icon?: React.ReactNode
    isLoading?: boolean
    trend?: "up" | "down" | "neutral"
    trendValue?: string
    className?: string
}

export function MetricCard({ title, value, icon, isLoading, trend, trendValue, className }: MetricCardProps) {
    return (
        <Card className={cn("shadow-sm border-none bg-card", className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                    {title}
                </CardTitle>
                {icon && <div className="text-muted-foreground">{icon}</div>}
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Skeleton className="h-10 w-20" />
                ) : (
                    <div className="flex flex-col">
                        <div className="text-4xl font-bold font-sans text-sidebar-primary tracking-tight">
                            {value}
                        </div>
                        {(trend || trendValue) && (
                            <p className={cn("text-xs font-medium mt-1",
                                trend === "up" ? "text-chart-4" :
                                    trend === "down" ? "text-destructive" : "text-muted-foreground"
                            )}>
                                {trend === "up" && "↑ "}
                                {trend === "down" && "↓ "}
                                {trendValue}
                            </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
