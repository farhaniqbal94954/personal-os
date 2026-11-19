interface KpiCardProps {
  label: string
  value: string
  foot?: string
  footColor?: 'income' | 'expense' | 'warning' | 'muted'
  icon?: string
}

export default function KpiCard({ label, value, foot, footColor = 'muted', icon }: KpiCardProps) {
  const footClass = {
    income:  'text-blue-600 dark:text-blue-400',
    expense: 'text-red-500 dark:text-red-400',
    warning: 'text-amber-500 dark:text-amber-400',
    muted:   'text-slate-400 dark:text-slate-500',
  }[footColor]

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-tight">
          {label}
        </span>
        {icon && (
          <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-base shrink-0">
            {icon}
          </span>
        )}
      </div>
      <div className="text-[1.6rem] font-black tracking-tight text-slate-900 dark:text-white leading-tight mb-1">
        {value}
      </div>
      {foot && (
        <div className={`text-xs font-semibold ${footClass}`}>{foot}</div>
      )}
    </div>
  )
}
