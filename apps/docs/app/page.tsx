import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black text-white">
      <div className="container mx-auto px-4 text-center">
        <h1 className="mb-4 text-6xl font-bold tracking-tight">
          val<span className="text-emerald-400">rs</span>
        </h1>
        <p className="mb-8 text-xl text-zinc-400">
          High-performance schema validation powered by Rust and WebAssembly
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/docs"
            className="rounded-lg bg-emerald-500 px-8 py-3 font-semibold text-white transition hover:bg-emerald-600"
          >
            Get Started
          </Link>
          <Link
            href="/docs/api"
            className="rounded-lg border border-zinc-700 px-8 py-3 font-semibold text-white transition hover:border-zinc-500 hover:bg-zinc-800"
          >
            API Reference
          </Link>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="mb-2 text-lg font-semibold text-emerald-400">Fast</h3>
            <p className="text-sm text-zinc-400">
              Rust-powered validation competitive with the fastest JS validators
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="mb-2 text-lg font-semibold text-emerald-400">Portable</h3>
            <p className="text-sm text-zinc-400">
              Works in browsers (WASM) and Node.js with automatic fallback
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="mb-2 text-lg font-semibold text-emerald-400">Standard</h3>
            <p className="text-sm text-zinc-400">
              Implements Standard Schema v1 for universal interoperability
            </p>
          </div>
        </div>
        <div className="mt-12">
          <pre className="inline-block rounded-lg bg-zinc-800/50 px-6 py-3 text-left text-sm">
            <code className="text-zinc-300">npm install valrs</code>
          </pre>
        </div>
      </div>
    </main>
  );
}
