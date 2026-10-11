import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { getProduct, products, type ProductStatus } from "@/content/products";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = getProduct((await params).slug);
  if (!product) return {};
  return {
    title: `${product.name} | LuMa Labs`,
    description: product.tagline,
  };
}

const statusStyles: Record<ProductStatus, string> = {
  Live: "border-emerald-300/25 bg-emerald-300/[0.06] text-emerald-200",
  Pilot: "border-[#00D7E6]/30 bg-[#00D7E6]/[0.06] text-[#55ECE9]",
  "In Entwicklung": "border-[#00D7E6]/30 bg-[#00D7E6]/[0.06] text-[#55ECE9]",
  "Im Aufbau": "border-amber-300/25 bg-amber-300/[0.05] text-amber-200",
  Geplant: "border-white/15 bg-white/[0.03] text-slate-300",
};

export default async function ProductPage({ params }: Props) {
  const product = getProduct((await params).slug);
  if (!product) notFound();

  const index = products.indexOf(product);
  const next = products[(index + 1) % products.length];

  return (
    <PageShell>
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_75%_20%,rgba(0,215,230,.10),transparent_40%)]">
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-16 lg:px-10">
          <Link href="/#loesungen" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400 transition hover:text-[#00D7E6]">
            <ArrowLeft className="h-4 w-4" /> Alle Lösungen
          </Link>

          <div className="mt-10 flex flex-col gap-8 sm:flex-row sm:items-center">
            <Image src={product.icon} alt="" width={112} height={112} unoptimized className="h-24 w-24 shrink-0 rounded-[22px] sm:h-28 sm:w-28" />
            <div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusStyles[product.status]}`}>
                {product.status}
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                {product.name.split(" ")[0]} <span className="text-[#00AFC2]">{product.name.split(" ").slice(1).join(" ")}</span>
              </h1>
              <p className="mt-3 text-lg text-slate-300">{product.tagline}</p>
            </div>
          </div>

          <p className="mt-10 max-w-3xl border-l border-[#00D7E6]/60 pl-5 leading-7 text-slate-300/90">
            {product.intro}
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 py-16 md:grid-cols-[1.6fr_1fr] lg:px-10">
        <div className="rounded-xl border border-white/10 bg-[#0A1924] p-7">
          <p className="text-xs font-medium uppercase tracking-[0.26em] text-[#00D7E6]">Funktionen</p>
          <ul className="mt-5 space-y-3">
            {product.features.map((feature) => (
              <li key={feature} className="flex gap-3 leading-7 text-slate-300">
                <Check className="mt-1.5 h-4 w-4 shrink-0 text-[#00AFC2]" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-[#0A1924] p-7">
            <p className="text-xs font-medium uppercase tracking-[0.26em] text-[#00D7E6]">Technologie</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {product.stack.map((item) => (
                <span key={item} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-slate-300">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {product.links.map((link) => (
              <Link key={link.href} href={link.href} className="inline-flex items-center justify-between rounded-md border border-[#00AFC2]/55 bg-gradient-to-r from-[#008A99] to-[#00AFC2] px-5 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-white">
                {link.label} <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
            <Link href={`/${product.roadmap}`} className="inline-flex items-center justify-between rounded-md border border-[#00D7E6]/35 bg-[#00D7E6]/[0.05] px-5 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#55ECE9]">
              Stand in der Roadmap <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
          <Link href={`/loesungen/${next.slug}`} className="group flex items-center justify-between text-slate-400 transition hover:text-white">
            <span className="text-xs uppercase tracking-[0.18em]">Nächste Lösung</span>
            <span className="inline-flex items-center gap-3 text-xl font-medium">
              {next.name} <ArrowRight className="h-5 w-5 text-[#00D7E6] transition group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
