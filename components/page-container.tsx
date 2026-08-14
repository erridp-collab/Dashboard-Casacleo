import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-[1240px] px-4 py-8 pb-28 sm:px-6 sm:py-10 md:pb-10 lg:px-6 lg:py-12">{children}</main>;
}
