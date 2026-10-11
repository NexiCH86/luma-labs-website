import type { MetadataRoute } from "next";
import { products } from "@/content/products";

const BASE = "https://lumalabs.ch";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    ["/", 1],
    ["/radar", 0.9],
    ["/radar/sat", 0.8],
    ["/radar/stars", 0.8],
    ...products.map((product) => [`/loesungen/${product.slug}`, 0.6] as const),
    ["/impressum", 0.2],
    ["/datenschutz", 0.2],
  ] as const;

  return pages.map(([path, priority]) => ({
    url: `${BASE}${path}`,
    changeFrequency: "weekly",
    priority,
  }));
}
