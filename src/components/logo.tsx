"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
  subtext?: string;
}

export function RenDeskLogo({
  size = 36,
  className,
  showText = false,
  textClassName,
  subtext = "Workplace OS",
}: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className="relative flex shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-xs select-none"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-transform duration-200 hover:scale-105"
        >
          <defs>
            {/* Japanese Lacquer / Deep Space Gradient background */}
            <linearGradient id="rd-bg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0B132B" />
              <stop offset="60%" stopColor="#1C2541" />
              <stop offset="100%" stopColor="#1E1B4B" />
            </linearGradient>

            {/* Ren (Connection / Harmony) Gradient */}
            <linearGradient id="rd-primary" x1="8" y1="8" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="50%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>

            {/* Glowing Accent Node */}
            <linearGradient id="rd-glow" x1="22" y1="8" x2="28" y2="14" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>

          {/* Premium Base Squircle */}
          <rect width="36" height="36" rx="9.5" fill="url(#rd-bg)" />
          <rect
            x="0.75"
            y="0.75"
            width="34.5"
            height="34.5"
            rx="8.75"
            stroke="white"
            strokeOpacity="0.14"
            strokeWidth="0.75"
          />

          {/* Foundation Pillar (Pure Architectural White) */}
          <rect x="7.5" y="7.5" width="4.2" height="21" rx="2.1" fill="#FFFFFF" />

          {/* Upper Zen / Ren Loop (Continuous Harmony) */}
          <path
            d="M11.7 7.5H18C21.6 7.5 24.2 9.8 24.2 13.2C24.2 16.6 21.6 18.9 18 18.9H11.7V7.5Z"
            fill="url(#rd-primary)"
          />

          {/* Loop Inner Negative Space */}
          <path
            d="M11.7 11.2H17.2C18.9 11.2 20.1 12 20.1 13.2C20.1 14.4 18.9 15.2 17.2 15.2H11.7V11.2Z"
            fill="#0F172A"
          />

          {/* Dynamic Forward Desk Wing / Momentum Kick */}
          <path
            d="M15.8 17.2L22.6 26.6C23.2 27.4 24.4 27.5 25.1 26.8C25.8 26.1 25.7 25 25 24.2L19.4 17.2H15.8Z"
            fill="url(#rd-primary)"
          />

          {/* Ren Nucleus: Connected Employee / Pulse Node */}
          <circle cx="25.5" cy="10" r="2.2" fill="url(#rd-glow)" />
        </svg>
      </span>

      {showText && (
        <div className="flex flex-col">
          <span className={cn("text-base font-bold tracking-tight text-foreground leading-tight", textClassName)}>
            Ren<span className="text-primary font-semibold">Desk</span>
          </span>
          {subtext && (
            <span className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground">
              {subtext}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { RenDeskLogo as OfficeFlowLogo, RenDeskLogo as OfficeFlowLogoCard };
