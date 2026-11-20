interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

/** title on top, buttons wrap underneath on phones; side by side on larger screens */
export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="sm:shrink-0 sm:mt-0.5 [&>div]:flex-wrap">{action}</div>}
    </div>
  )
}
