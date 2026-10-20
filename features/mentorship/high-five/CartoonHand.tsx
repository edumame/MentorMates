"use client";

import { cn } from "@/lib/utils";

export type HandPose = "open" | "wave" | "fist" | "jazz";

interface CartoonHandProps {
  pose?: HandPose;
  className?: string;
  skinTone?: "warm" | "cool";
  flip?: boolean;
}

const SKIN = {
  warm: { base: "#F5C9A8", shadow: "#E8A87C", outline: "#C4784A" },
  cool: { base: "#FDDCB5", shadow: "#E8B88A", outline: "#B8734A" },
};

export function CartoonHand({
  pose = "open",
  className,
  skinTone = "warm",
  flip = false,
}: CartoonHandProps) {
  const skin = SKIN[skinTone];

  return (
    <svg
      viewBox="0 0 120 140"
      className={cn("drop-shadow-md", flip && "scale-x-[-1]", className)}
      aria-hidden
    >
      {/* Wrist */}
      <rect
        x="38"
        y="108"
        width="44"
        height="28"
        rx="10"
        fill={skin.shadow}
        stroke={skin.outline}
        strokeWidth="2"
      />

      {/* Palm */}
      <ellipse
        cx="60"
        cy="78"
        rx="38"
        ry="34"
        fill={skin.base}
        stroke={skin.outline}
        strokeWidth="2.5"
      />

      {/* Palm crease */}
      <path
        d="M 42 72 Q 60 82 78 72"
        fill="none"
        stroke={skin.outline}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />

      {pose === "fist" ? (
        <>
          <rect
            x="28"
            y="38"
            width="18"
            height="42"
            rx="9"
            fill={skin.base}
            stroke={skin.outline}
            strokeWidth="2"
          />
          <rect
            x="46"
            y="30"
            width="18"
            height="48"
            rx="9"
            fill={skin.base}
            stroke={skin.outline}
            strokeWidth="2"
          />
          <rect
            x="64"
            y="32"
            width="18"
            height="46"
            rx="9"
            fill={skin.base}
            stroke={skin.outline}
            strokeWidth="2"
          />
          <rect
            x="82"
            y="40"
            width="16"
            height="38"
            rx="8"
            fill={skin.base}
            stroke={skin.outline}
            strokeWidth="2"
          />
          <ellipse
            cx="60"
            cy="72"
            rx="34"
            ry="28"
            fill={skin.shadow}
            stroke={skin.outline}
            strokeWidth="2"
          />
        </>
      ) : pose === "jazz" ? (
        <>
          {/* Jazz hands — fingers spread wide */}
          <Finger x={18} y={18} w={14} h={52} r={7} rot={-25} skin={skin} />
          <Finger x={34} y={8} w={14} h={58} r={7} rot={-10} skin={skin} />
          <Finger x={52} y={4} w={14} h={62} r={7} rot={0} skin={skin} />
          <Finger x={70} y={8} w={14} h={58} r={7} rot={10} skin={skin} />
          <Finger x={88} y={18} w={14} h={52} r={7} rot={25} skin={skin} />
        </>
      ) : (
        <>
          {/* Default / wave fingers */}
          <Finger x={22} y={28} w={14} h={48} r={7} rot={-8} skin={skin} />
          <Finger x={38} y={18} w={14} h={54} r={7} rot={-3} skin={skin} />
          <Finger x={54} y={14} w={14} h={58} r={7} rot={0} skin={skin} />
          <Finger x={70} y={18} w={14} h={54} r={7} rot={3} skin={skin} />
          <Finger x={86} y={30} w={12} h={42} r={6} rot={12} skin={skin} />
        </>
      )}
    </svg>
  );
}

function Finger({
  x,
  y,
  w,
  h,
  r,
  rot,
  skin,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  rot: number;
  skin: (typeof SKIN)["warm"];
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={r}
      fill={skin.base}
      stroke={skin.outline}
      strokeWidth="2"
      transform={`rotate(${rot} ${x + w / 2} ${y + h})`}
    />
  );
}
