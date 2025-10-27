"use client"

import * as React from "react"
import type * as DrawerPrimitive from "vaul"

import { cn } from "@/lib/utils"

const loadVaul = () => import("vaul")

const LazyDrawerRoot = React.lazy(() =>
  loadVaul().then((module) => ({
    default: module.Drawer.Root,
  }))
)

const LazyDrawerTrigger = React.lazy(() =>
  loadVaul().then((module) => ({
    default: module.Drawer.Trigger,
  }))
)

const LazyDrawerPortal = React.lazy(() =>
  loadVaul().then((module) => ({
    default: module.Drawer.Portal,
  }))
)

const LazyDrawerClose = React.lazy(() =>
  loadVaul().then((module) => ({
    default: module.Drawer.Close,
  }))
)

const LazyDrawerOverlay = React.lazy(() =>
  loadVaul().then((module) => ({
    default: module.Drawer.Overlay,
  }))
)

const LazyDrawerContent = React.lazy(() =>
  loadVaul().then((module) => ({
    default: module.Drawer.Content,
  }))
)

const LazyDrawerTitle = React.lazy(() =>
  loadVaul().then((module) => ({
    default: module.Drawer.Title,
  }))
)

const LazyDrawerDescription = React.lazy(() =>
  loadVaul().then((module) => ({
    default: module.Drawer.Description,
  }))
)

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Drawer.Root>) => (
  <React.Suspense fallback={null}>
    <LazyDrawerRoot
      shouldScaleBackground={shouldScaleBackground}
      {...props}
    />
  </React.Suspense>
)
Drawer.displayName = "Drawer"

const DrawerTrigger = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Drawer.Trigger>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Drawer.Trigger>
>((props, ref) => (
  <React.Suspense fallback={null}>
    <LazyDrawerTrigger ref={ref} {...props} />
  </React.Suspense>
))
DrawerTrigger.displayName = "DrawerTrigger"

const DrawerPortal = (
  props: React.ComponentPropsWithoutRef<
    typeof DrawerPrimitive.Drawer.Portal
  >
) => (
  <React.Suspense fallback={null}>
    <LazyDrawerPortal {...props} />
  </React.Suspense>
)

const DrawerClose = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Drawer.Close>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Drawer.Close>
>((props, ref) => (
  <React.Suspense fallback={null}>
    <LazyDrawerClose ref={ref} {...props} />
  </React.Suspense>
))
DrawerClose.displayName = "DrawerClose"

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Drawer.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Drawer.Overlay>
>(({ className, ...props }, ref) => (
  <React.Suspense fallback={null}>
    <LazyDrawerOverlay
      ref={ref}
      className={cn("fixed inset-0 z-50 bg-black/80", className)}
      {...props}
    />
  </React.Suspense>
))
DrawerOverlay.displayName = "DrawerOverlay"

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Drawer.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Drawer.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <React.Suspense fallback={null}>
      <LazyDrawerContent
        ref={ref}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
          className
        )}
        {...props}
      >
        <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
        {children}
      </LazyDrawerContent>
    </React.Suspense>
  </DrawerPortal>
))
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Drawer.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Drawer.Title>
>(({ className, ...props }, ref) => (
  <React.Suspense fallback={null}>
    <LazyDrawerTitle
      ref={ref}
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  </React.Suspense>
))
DrawerTitle.displayName = "DrawerTitle"

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Drawer.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Drawer.Description>
>(({ className, ...props }, ref) => (
  <React.Suspense fallback={null}>
    <LazyDrawerDescription
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  </React.Suspense>
))
DrawerDescription.displayName = "DrawerDescription"

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
