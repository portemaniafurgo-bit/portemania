import { cn } from "@/lib/utils";

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, className }) {
  return (
    <div className={cn(
      "bg-card rounded-2xl border border-border p-5 relative overflow-hidden",
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-heading font-bold mt-1 text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        )}
      </div>
      {trend && (
        <p className={cn(
          "text-xs font-medium mt-3",
          trend > 0 ? "text-emerald-600" : "text-red-500"
        )}>
          {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}% vs mes anterior
        </p>
      )}
    </div>
  );
}