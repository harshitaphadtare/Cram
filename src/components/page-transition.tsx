"use client";

import { usePathname } from "next/navigation";

/**
 * Re-keys the route content on navigation so each page fades up into place. Sits inside the app
 * layout, so the sidebar, tabs and top bar stay perfectly still while content changes.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="cram-page-enter flex flex-1 flex-col gap-4">
      {children}
    </div>
  );
}
