"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";

// Animation variants for reusability
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
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
  rest: { y: 0, boxShadow: "0 0 0 rgba(16, 185, 129, 0)" },
  hover: {
    y: -4,
    boxShadow: "0 8px 30px rgba(16, 185, 129, 0.15)",
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

const floatingAnimation: Variants = {
  animate: {
    y: [0, -3, 0],
    transition: {
      duration: 2.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

const pulseGlow: Variants = {
  animate: {
    textShadow: [
      "0 0 8px rgba(52, 211, 153, 0.4)",
      "0 0 16px rgba(52, 211, 153, 0.6)",
      "0 0 8px rgba(52, 211, 153, 0.4)",
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

const featureCards = [
  {
    title: "Fast",
    emoji: "⚡",
    description: "Rust-powered validation competitive with the fastest JS validators",
  },
  {
    title: "Portable",
    emoji: "🌍",
    description: "Works in browsers (WASM) and Node.js with automatic fallback",
  },
  {
    title: "Standard",
    emoji: "📐",
    description: "Implements Standard Schema v1 for universal interoperability",
  },
];

function FloatingOrb({ className }: { className: string }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl opacity-20 ${className}`}
      animate={{
        scale: [1, 1.1, 1],
        opacity: [0.15, 0.25, 0.15],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
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
        <h3 className="mb-2 text-lg font-semibold text-emerald-400">{title}</h3>
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
          borderColor: "rgba(52, 211, 153, 0.3)",
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
            className="text-emerald-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            valrs
          </motion.span>
          <motion.span
            className="inline-block w-2 h-4 ml-1 bg-emerald-400 align-middle"
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

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black text-white overflow-hidden">
      {/* Animated background orbs */}
      <FloatingOrb className="w-96 h-96 bg-emerald-500 -top-48 -left-48" />
      <FloatingOrb className="w-64 h-64 bg-emerald-600 top-1/4 -right-32" />
      <FloatingOrb className="w-80 h-80 bg-teal-500 -bottom-40 left-1/4" />

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
              className="text-emerald-400 inline-block"
              variants={shouldReduceMotion ? {} : floatingAnimation}
              animate="animate"
            >
              <motion.span
                variants={shouldReduceMotion ? {} : pulseGlow}
                animate="animate"
              >
                rs
              </motion.span>
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
                className="inline-block rounded-lg bg-emerald-500 px-8 py-3 font-semibold text-white transition hover:bg-emerald-600"
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
