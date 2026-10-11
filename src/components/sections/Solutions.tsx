import Image from "next/image";
import Link from "next/link";
import { products } from "@/content/products";

export function Solutions() {
  return (
    <section id="loesungen" className="scroll-mt-24 py-28">
      <div className="mx-auto max-w-[1480px] px-6 lg:px-10">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.26em] text-[#00D7E6]">
              Lösungen
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              Eine Plattform. Acht spezialisierte Produktlinien.
            </h2>
          </div>

          <p className="max-w-lg leading-7 text-slate-400">
            Jede Lösung deckt einen klaren Bereich ab. Gemeinsam verbinden sie
            Engineering, Software, BIM und Smart Infrastructure.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => (
            <Link
              key={product.slug}
              href={`/loesungen/${product.slug}`}
              className="group min-h-64 rounded-xl border border-white/10 bg-[#0A1924] p-7 shadow-[0_10px_35px_rgba(0,0,0,0.14)] transition duration-300 hover:-translate-y-2 hover:border-[#00AFC2]/60 hover:bg-[#0D202B] hover:shadow-[0_20px_50px_rgba(0,175,194,0.12)]"
            >
              <div className="flex items-start justify-between gap-4">
                <Image src={product.icon} alt="" width={56} height={56} unoptimized className="h-14 w-14 rounded-xl" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {product.status}
                </span>
              </div>

              <h3 className="mt-7 text-2xl font-medium text-white">
                {product.name.split(" ")[0]}{" "}
                <span className="text-[#00AFC2]">{product.name.split(" ").slice(1).join(" ")}</span>
              </h3>

              <p className="mt-4 leading-7 text-slate-400">{product.tagline}</p>

              <div className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-[#00D7E6] transition group-hover:translate-x-1">
                Mehr erfahren →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
