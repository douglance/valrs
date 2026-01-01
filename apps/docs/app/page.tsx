"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

// Animation variants for reusability
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const cardHover: Variants = {
  rest: { y: 0, boxShadow: "0 0 0 rgba(255, 79, 0, 0)" },
  hover: {
    y: -4,
    boxShadow: "0 8px 30px rgba(255, 79, 0, 0.15)",
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

// "rs" entrance animation - scale up with slight overshoot, no continuous animation
const rsEntrance: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    textShadow: "0 0 12px rgba(255, 79, 0, 0.5)",
    transition: {
      duration: 0.5,
      ease: [0.34, 1.56, 0.64, 1], // Custom spring-like easing with overshoot
    },
  },
};

const featureCards = [
  {
    title: "Fast",
    emoji: "\u26A1",
    description: "Rust-powered validation competitive with the fastest JS validators",
  },
  {
    title: "Portable",
    emoji: "\uD83C\uDF0D",
    description: "Works in browsers (WASM) and Node.js with automatic fallback",
  },
  {
    title: "Standard",
    emoji: "\uD83D\uDCD0",
    description: "Implements Standard Schema v1 for universal interoperability",
  },
];

// Generate random gear config - randomized on each load
function generateGearConfig() {
  return Array.from({ length: 38 }).map((_, i) => {
    // Random size with slight bias toward smaller (for depth)
    const sizeRand = Math.random();
    const size = Math.floor(Math.pow(sizeRand, 0.7) * 1800) + 30; // 30-1830px

    // Random position across entire viewport
    const top = Math.random() * 140 - 20; // -20% to 120%
    const left = Math.random() * 140 - 20;

    // Opacity based on size with randomness
    const normalizedSize = (size - 30) / 1800;
    const baseOpacity = 0.03 + Math.pow(normalizedSize, 2.2) * 0.38;
    const opacityVariation = (Math.random() - 0.5) * 0.08;
    const opacity = Math.max(0.02, Math.min(0.45, baseOpacity + opacityVariation));

    // Random speed and direction
    const duration = 25 + Math.random() * 95; // 25-120s
    const direction = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;

    return {
      size,
      opacity,
      top: `${top}%`,
      left: `${left}%`,
      duration,
      direction,
      delay: 0,
    };
  });
}

// Rust-style gear with thin ring and sharp triangular teeth
function RotatingGear({
  size,
  top,
  left,
  right,
  bottom,
  duration,
  direction = 1,
  delay = 0,
  opacity = 0.15,
}: {
  size: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  duration: number;
  direction?: 1 | -1;
  delay?: number;
  opacity?: number;
}) {
  const teeth = 32; // Many teeth like Rust logo
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size * 0.45;
  const innerRadius = size * 0.38;
  const toothHeight = size * 0.08;
  const ringThickness = size * 0.04;

  // Generate sharp triangular teeth path
  const teethPath = Array.from({ length: teeth })
    .map((_, i) => {
      const angle1 = (i / teeth) * Math.PI * 2;
      const angle2 = ((i + 0.5) / teeth) * Math.PI * 2;
      const angle3 = ((i + 1) / teeth) * Math.PI * 2;

      // Base points on outer ring
      const x1 = cx + Math.cos(angle1) * outerRadius;
      const y1 = cy + Math.sin(angle1) * outerRadius;

      // Tooth tip (sharp point)
      const x2 = cx + Math.cos(angle2) * (outerRadius + toothHeight);
      const y2 = cy + Math.sin(angle2) * (outerRadius + toothHeight);

      // Next base point
      const x3 = cx + Math.cos(angle3) * outerRadius;
      const y3 = cy + Math.sin(angle3) * outerRadius;

      return `L ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}`;
    })
    .join(" ");

  const firstAngle = 0;
  const startX = cx + Math.cos(firstAngle) * outerRadius;
  const startY = cy + Math.sin(firstAngle) * outerRadius;

  return (
    <motion.div
      className="absolute"
      style={{ top, left, right, bottom }}
      initial={{ rotate: 0 }}
      animate={{ rotate: 360 * direction }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "linear",
        delay,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ opacity }}
      >
        {/* Outer ring with teeth */}
        <path
          d={`M ${startX} ${startY} ${teethPath} Z`}
          fill="#FF4F00"
        />
        {/* Cut out inner circle to make thin ring */}
        <circle
          cx={cx}
          cy={cy}
          r={innerRadius}
          fill="#0a0a0a"
        />
        {/* Inner ring edge */}
        <circle
          cx={cx}
          cy={cy}
          r={innerRadius}
          fill="none"
          stroke="#CC3D00"
          strokeWidth={ringThickness}
        />
        {/* Center hole (like Rust logo) */}
        <circle
          cx={cx}
          cy={cy}
          r={size * 0.25}
          fill="#0a0a0a"
        />
      </svg>
    </motion.div>
  );
}

function FeatureCard({
  title,
  emoji,
  description,
  index,
}: {
  title: string;
  emoji: string;
  description: string;
  index: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.5,
        delay: shouldReduceMotion ? 0 : index * 0.1,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      <motion.div
        className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 cursor-default"
        variants={cardHover}
        initial="rest"
        whileHover="hover"
      >
        <motion.div
          className="mb-3 text-2xl"
          whileHover={{ scale: 1.2, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          {emoji}
        </motion.div>
        <h3 className="mb-2 text-lg font-semibold text-rust-400">{title}</h3>
        <p className="text-sm text-zinc-400">{description}</p>
      </motion.div>
    </motion.div>
  );
}

function TypewriterCode() {
  return (
    <motion.div
      className="mt-12"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 0.5 }}
    >
      <motion.pre
        className="inline-block rounded-lg bg-zinc-800/50 px-6 py-3 text-left text-sm border border-zinc-700/50"
        whileHover={{
          borderColor: "rgba(255, 79, 0, 0.3)",
          transition: { duration: 0.2 },
        }}
      >
        <code className="text-zinc-300">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
          >
            npm install{" "}
          </motion.span>
          <motion.span
            className="text-rust-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            valrs
          </motion.span>
          <motion.span
            className="inline-block w-2 h-4 ml-1 bg-rust-400 align-middle"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
          />
        </code>
      </motion.pre>
    </motion.div>
  );
}

export default function HomePage() {
  const shouldReduceMotion = useReducedMotion();
  const [gears, setGears] = useState<ReturnType<typeof generateGearConfig>>([]);

  // Generate random gears on client-side only to avoid hydration mismatch
  useEffect(() => {
    setGears(generateGearConfig());
  }, []);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black text-white overflow-hidden">
      {/* Giant rotating gears in background - many random gears */}
      <div className="absolute inset-0 overflow-hidden">
        {gears.map((gear, i) => (
          <RotatingGear key={i} {...gear} />
        ))}

        {/* Heavy blur overlay to obscure the gears */}
        <div className="absolute inset-0 backdrop-blur-lg bg-gradient-to-b from-zinc-900/60 via-zinc-900/40 to-black/60" />
      </div>

      <div className="container relative z-10 mx-auto px-4 text-center">
        {/* Hero Section with staggered animations */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* Logo */}
          <motion.h1
            className="mb-4 text-6xl font-bold tracking-tight"
            variants={fadeInUp}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          >
            val
            <motion.span
              className="text-rust-400 inline-block"
              variants={shouldReduceMotion ? fadeInUp : rsEntrance}
            >
              rs
            </motion.span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="mb-8 text-xl text-zinc-400"
            variants={fadeInUp}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          >
            High-performance schema validation powered by Rust and WebAssembly
          </motion.p>

          {/* Buttons */}
          <motion.div
            className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
            variants={fadeInUp}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Link
                href="/docs"
                className="inline-block rounded-lg bg-rust-500 px-8 py-3 font-semibold text-white transition hover:bg-rust-600"
              >
                Get Started
              </Link>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Link
                href="/docs/api"
                className="inline-block rounded-lg border border-zinc-700 px-8 py-3 font-semibold text-white transition hover:border-zinc-500 hover:bg-zinc-800"
              >
                API Reference
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Feature Cards with scroll-triggered reveal */}
        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {featureCards.map((card, index) => (
            <FeatureCard
              key={card.title}
              title={card.title}
              emoji={card.emoji}
              description={card.description}
              index={index}
            />
          ))}
        </div>

        {/* Code snippet with typewriter effect */}
        <TypewriterCode />
      </div>
    </main>
  );
}
