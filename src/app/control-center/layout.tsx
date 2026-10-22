import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Control Center | LuMa Labs",
  robots: { index: false, follow: false },
};

export default function ControlCenterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
