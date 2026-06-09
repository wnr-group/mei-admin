interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <p className="text-sm text-red-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-[#c9a465] underline underline-offset-2"
        >
          Try again
        </button>
      )}
    </div>
  )
}
