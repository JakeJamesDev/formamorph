import { type ReactNode } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog"

export function ConfirmDialog({
  triggerText = "Open Dialog",
  title = "Are you sure?",
  description = "This action cannot be undone.",
  onConfirm,
  onCancel,
  children,
  open,
  onOpenChange,
}: {
  triggerText?: string
  title?: ReactNode
  description?: ReactNode
  onConfirm?: () => void
  onCancel?: () => void
  children?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const handleConfirm = () => {
    onConfirm?.()
  }

  const handleCancel = () => {
    onCancel?.()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {children && <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
