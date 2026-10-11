import { PageShell } from "@/components/layout/PageShell";

export function LegalPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-6 py-20 lg:px-10">
        <p className="text-xs font-medium uppercase tracking-[0.26em] text-[#00D7E6]">{eyebrow}</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{title}</h1>
        <div className="mt-10 space-y-8 leading-7 text-slate-300 [&_a]:text-[#55ECE9] [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
          {children}
        </div>
      </article>
    </PageShell>
  );
}
