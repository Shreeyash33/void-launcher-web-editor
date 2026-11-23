export default function Home() {
  return (
    <main className="min-h-screen bg-[#080808] text-[#ededed]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-[#a8a29a]">
          Void Launcher
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Web Editor
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-[#a8a29a]">
          A client-side editor for the launcher map, page grids, and custom widgets.
          Import a phone export, edit locally, and export a file the launcher can restore.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <span className="rounded-full border border-[#3a3a3a] bg-[#141414] px-4 py-2 font-mono text-xs text-[#e6e2d8]">
            Scaffold ready
          </span>
          <span className="rounded-full border border-[#3a3a3a] bg-[#141414] px-4 py-2 font-mono text-xs text-[#a8a29a]">
            Map editor next
          </span>
        </div>
      </div>
    </main>
  );
}
