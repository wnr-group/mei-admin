interface EmptyStateProps {
  message: string
  action?: React.ReactNode
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <p className="text-sm text-zinc-400">{message}</p>
      {action}
    </div>
  )
}
