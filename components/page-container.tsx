import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-[1200px] px-4 py-8 pb-24 sm:px-6 md:pb-8 lg:px-8">{children}</main>;
}

