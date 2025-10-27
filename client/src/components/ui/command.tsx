import * as React from "react"
import { type DialogProps } from "@radix-ui/react-dialog"
import type * as CommandPrimitive from "cmdk"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"

const loadCmdk = () => import("cmdk")

const LazyCommandRoot = React.lazy(() =>
  loadCmdk().then((module) => ({
    default: module.Command,
  }))
)

const LazyCommandInput = React.lazy(() =>
  loadCmdk().then((module) => ({
    default: module.Command.Input,
  }))
)

const LazyCommandList = React.lazy(() =>
  loadCmdk().then((module) => ({
    default: module.Command.List,
  }))
)

const LazyCommandEmpty = React.lazy(() =>
  loadCmdk().then((module) => ({
    default: module.Command.Empty,
  }))
)

const LazyCommandGroup = React.lazy(() =>
  loadCmdk().then((module) => ({
    default: module.Command.Group,
  }))
)

const LazyCommandSeparator = React.lazy(() =>
  loadCmdk().then((module) => ({
    default: module.Command.Separator,
  }))
)

const LazyCommandItem = React.lazy(() =>
  loadCmdk().then((module) => ({
    default: module.Command.Item,
  }))
)

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Command>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Command>
>(({ className, ...props }, ref) => (
  <React.Suspense fallback={null}>
    <LazyCommandRoot
      ref={ref}
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        className
      )}
      {...props}
    />
  </React.Suspense>
))
Command.displayName = "Command"

const CommandDialog = ({ children, ...props }: DialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Command.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Command.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <React.Suspense
      fallback={
        <div
          className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm"
        />
      }
    >
      <LazyCommandInput
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </React.Suspense>
  </div>
))

CommandInput.displayName = "CommandInput"

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Command.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Command.List>
>(({ className, ...props }, ref) => (
  <React.Suspense fallback={null}>
    <LazyCommandList
      ref={ref}
      className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
      {...props}
    />
  </React.Suspense>
))

CommandList.displayName = "CommandList"

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Command.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Command.Empty>
>((props, ref) => (
  <React.Suspense fallback={null}>
    <LazyCommandEmpty
      ref={ref}
      className="py-6 text-center text-sm"
      {...props}
    />
  </React.Suspense>
))

CommandEmpty.displayName = "CommandEmpty"

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Command.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Command.Group>
>(({ className, ...props }, ref) => (
  <React.Suspense fallback={null}>
    <LazyCommandGroup
      ref={ref}
      className={cn(
        "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        className
      )}
      {...props}
    />
  </React.Suspense>
))

CommandGroup.displayName = "CommandGroup"

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Command.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Command.Separator>
>(({ className, ...props }, ref) => (
  <React.Suspense fallback={null}>
    <LazyCommandSeparator
      ref={ref}
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  </React.Suspense>
))
CommandSeparator.displayName = "CommandSeparator"

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Command.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Command.Item>
>(({ className, ...props }, ref) => (
  <React.Suspense fallback={null}>
    <LazyCommandItem
      ref={ref}
      className={cn(
        "relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected='true']:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  </React.Suspense>
))

CommandItem.displayName = "CommandItem"

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
CommandShortcut.displayName = "CommandShortcut"

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
