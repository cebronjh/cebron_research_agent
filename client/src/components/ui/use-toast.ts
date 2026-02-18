import * as React from "react"

type ToasterToast = {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: "default" | "destructive"
}

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToastActionElement = React.ReactElement

export function useToast() {
  const [toasts, setToasts] = React.useState<ToasterToast[]>([])

  function toast({ ...props }: Omit<ToasterToast, "id">) {
    const id = Math.random().toString()
    setToasts((prev) => [...prev, { ...props, id }])
    return { id }
  }

  return {
    toast,
    toasts,
  }
}
