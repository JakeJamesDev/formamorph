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
import { useClosingSnapshot } from "@/lib/useClosingSnapshot"

/**
 * Yes/no confirmation prompt wrapping the Radix `AlertDialog`. Works controlled (`open`/`onOpenChange`)
 * or trigger-driven (pass `children` as the trigger); both `onConfirm`/`onCancel` are optional.
 */
export function ConfirmDialog({
  title = "Are you sure?",
  description = "This action cannot be undone.",
  onConfirm,
  onCancel,
  children,
  open,
  onOpenChange,
}: {
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

  // Hold the title/description shown while open so a controlled dialog keeps them through its fade-out, even
  // as the parent clears the state that drove them (e.g. `pendingDelete?.name` going undefined on close).
  const shown = useClosingSnapshot(open, { title, description })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {children && <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{shown.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {shown.description}
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
