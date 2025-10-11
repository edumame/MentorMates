"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "font-normal px-24 py-8 text-white bg-[#4B89EF] rounded-[12px] text-[16px] hover:bg-[#3E7EEA] [box-shadow:inset_0_32px_24px_0_rgba(255,255,255,0.05),inset_0_2px_1px_0_rgba(255,255,255,0.25),inset_0_0_0_1px_rgba(0,0,0,0.15),inset_0_-2px_1px_0_rgba(0,0,0,0.20),0_1px_2px_0_rgba(0,0,0,0.05)]",
        defaultGray: "font-normal px-24 py-8 rounded-[12px] bg-[rgba(0,0,0,0.05)] text-[16px] transition-colors duration-200 " +
          "[box-shadow:inset_0_0_0_1px_rgba(0,0,0,0.05),inset_0_-2px_1px_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.05)] " +
          "hover:bg-[rgba(0,0,0,0.07)] hover:[box-shadow:inset_0_0_0_1px_rgba(0,0,0,0.08),inset_0_-2px_1px_0_rgba(0,0,0,0.08),0_2px_4px_0_rgba(0,0,0,0.08)] " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 ",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        nav: "bg-none text-blue-900 hover:text-blue-600 text-lg font-semibold",
        link: "text-primary underline-offset-4 hover:underline",
        logIn: "bg-blue-500 text-white hover:bg-blue-800",
        success: "bg-green-700 text-white hover:bg-blue-900",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
