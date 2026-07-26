import { GitBranch } from "lucide-react";

export function GithubCta() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-400/10 via-white/[0.03] to-blue-500/10 p-8 sm:p-12">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
                Development
              </p>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                LuMa Labs wächst versioniert, dokumentiert und nachvollziehbar.
              </h2>
            </div>

            <a
              href="https://github.com/NexiCH86"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-medium text-slate-950 transition hover:bg-slate-200"
            >
              <GitBranch className="h-5 w-5" />
              GitHub-Profil öffnen
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
