"use client"

import { GripVertical } from "lucide-react"
import * as React from "react"
import type {
  ImperativePanelHandle,
  PanelGroupProps,
  PanelProps,
  PanelResizeHandleProps,
} from "react-resizable-panels"

import { cn } from "@/lib/utils"

const LazyPanelGroup = React.lazy(() =>
  import("react-resizable-panels").then((module) => ({
    default: module.PanelGroup,
  }))
)

const LazyPanel = React.lazy(() =>
  import("react-resizable-panels").then((module) => ({
    default: module.Panel,
  }))
)

const LazyPanelResizeHandle = React.lazy(() =>
  import("react-resizable-panels").then((module) => ({
    default: module.PanelResizeHandle,
  }))
)

const ResizablePanelGroup = ({
  className,
  ...props
}: PanelGroupProps & { className?: string }) => (
  <React.Suspense
    fallback={
      <div
        className={cn(
          "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
          className
        )}
      />
    }
  >
    <LazyPanelGroup
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className
      )}
      {...props}
    />
  </React.Suspense>
)

const ResizablePanel = React.forwardRef<ImperativePanelHandle, PanelProps>(
  (props, ref) => (
    <React.Suspense fallback={null}>
      <LazyPanel ref={ref} {...props} />
    </React.Suspense>
  )
)
ResizablePanel.displayName = "ResizablePanel"

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: PanelResizeHandleProps & { withHandle?: boolean }) => (
  <React.Suspense fallback={null}>
    <LazyPanelResizeHandle
      className={cn(
        "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
          <GripVertical className="h-2.5 w-2.5" />
        </div>
      )}
    </LazyPanelResizeHandle>
  </React.Suspense>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
