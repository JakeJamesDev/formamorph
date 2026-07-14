import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants, type ButtonProps } from "@/components/ui/button";
import { paginationSlots, pageWindow } from "@/lib/pagination"
import { useIsMobile } from "@/lib/useIsMobile"

const Pagination = ({
  className,
  ...props
}: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props} />
)
Pagination.displayName = "Pagination"

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props} />
))
PaginationContent.displayName = "PaginationContent"

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
))
PaginationItem.displayName = "PaginationItem"

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<ButtonProps, "size"> &
  React.ComponentProps<"a">

const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={cn(buttonVariants({
      // Current page: filled primary so it clearly stands out; others are quiet ghost buttons.
      variant: isActive ? "default" : "ghost",
      size,
    }), className)}
    {...props} />
)
PaginationLink.displayName = "PaginationLink"

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn("gap-1 pl-2.5", className)}
    {...props}>
    <ChevronLeft className="h-4 w-4" />
    <span className="hidden md:inline">Previous</span>
  </PaginationLink>
)
PaginationPrevious.displayName = "PaginationPrevious"

const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn("gap-1 pr-2.5", className)}
    {...props}>
    <span className="hidden md:inline">Next</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
)
PaginationNext.displayName = "PaginationNext"

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    aria-hidden
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}>
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
)
PaginationEllipsis.displayName = "PaginationEllipsis"

/**
 * The shared page footer: Previous · numbered strip · Next. The strip reserves a constant number of
 * equal-width cells (`paginationSlots`, padding short layouts with invisible spacers) so its width never
 * changes as you flip — keeping Previous/Next from reflowing. Used by every pager (game turns, AI-context
 * debug, community browser) so they stay consistent.
 */
function Pager({
  page,
  pageCount,
  onPageChange,
  className,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  className?: string
}) {
  const atStart = pageCount === 0 || page <= 1
  const atEnd = pageCount === 0 || page >= pageCount

  const isMobile = useIsMobile()

  const pageCell = (p: number) => (
    <PaginationItem key={`page-${p}`}>
      <PaginationLink
        href="#"
        isActive={page === p}
        onClick={(e) => {
          e.preventDefault()
          onPageChange(p)
        }}
      >
        {p}
      </PaginationLink>
    </PaginationItem>
  )

  const cells: React.ReactNode[] = []
  if (isMobile) {
    // Compact: just the three page numbers closest to the current one, no ellipsis or reserved spacers.
    for (const p of pageWindow(page, pageCount, 3)) cells.push(pageCell(p))
  } else {
    // Render page links individually, but collapse each contiguous run of spacers+ellipsis into ONE cell
    // whose width equals what those cells would occupy (so the strip's total width — and Previous/Next —
    // stays fixed) with the ellipsis centered inside it. This centers a lone ellipsis in the gap between the
    // two page groups regardless of how lopsided they are (e.g. "1 2 3 4  …  43").
    const slots = paginationSlots(page, pageCount)
    for (let i = 0; i < slots.length; ) {
      const slot = slots[i]
      if (slot.kind === "page") {
        cells.push(pageCell(slot.page))
        i += 1
      } else {
        let j = i
        let hasEllipsis = false
        while (j < slots.length && slots[j].kind !== "page") {
          if (slots[j].kind === "ellipsis") hasEllipsis = true
          j += 1
        }
        const runLen = j - i
        cells.push(
          <PaginationItem
            key={`gap-${i}`}
            aria-hidden={!hasEllipsis}
            className="flex items-center justify-center"
            // Match the width of `runLen` cells (2.5rem each) plus their inter-cell gaps (0.25rem).
            style={{ width: `calc(${runLen} * 2.5rem + ${runLen - 1} * 0.25rem)` }}
          >
            {hasEllipsis ? <PaginationEllipsis /> : null}
          </PaginationItem>,
        )
        i = j
      }
    }
  }

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => {
              e.preventDefault()
              if (!atStart) onPageChange(page - 1)
            }}
            className={atStart ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
        {cells}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => {
              e.preventDefault()
              if (!atEnd) onPageChange(page + 1)
            }}
            className={atEnd ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
Pager.displayName = "Pager"

export {
  Pager,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
