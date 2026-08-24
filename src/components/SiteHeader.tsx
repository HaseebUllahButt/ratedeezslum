"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <li>
      <Link
        href={href}
        className={`text-sm sm:text-base font-medium whitespace-nowrap transition-all duration-200 relative group inline-block py-1 ${
          active ? "text-lums-gold" : "text-white/90 hover:text-lums-gold"
        }`}
      >
        {children}
        <span
          className={`absolute bottom-0 left-0 h-0.5 bg-lums-gold transition-all duration-200 ${
            active ? "w-full" : "w-0 group-hover:w-full"
          }`}
        />
      </Link>
    </li>
  );
}

export default function SiteHeader() {
  return (
    <header className="bg-lums-header text-white shadow-lg relative overflow-hidden z-50">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-lums-gold via-lums-gold-dark to-lums-gold" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between pt-5 sm:pt-6 md:pt-7 pb-2 sm:pb-2.5">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group flex-shrink-0">
            <Image
              src="/slum-logo.svg"
              alt=""
              width={860}
              height={650}
              className="h-10 w-auto shrink-0 transition-transform group-hover:scale-105 sm:h-12 md:h-14"
            />
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-3xl font-bold tracking-tight leading-tight">
                RateDeezSlum
              </h1>
              <p className="text-xs sm:text-sm font-serif italic text-blue-200/80 leading-tight mt-0.5">
                Learning Besides Borders
              </p>
            </div>
          </Link>

          <div className="flex-shrink-0">
            <button
              type="button"
              className="bg-lums-gold px-2.5 py-1 sm:px-5 sm:py-2.5 text-[10px] sm:text-sm font-semibold text-lums-navy hover:bg-lums-gold-dark active:bg-lums-gold-dark transition-all uppercase tracking-wide cursor-pointer shadow-sm hover:shadow-md touch-manipulation whitespace-nowrap"
            >
              Sign In
            </button>
          </div>
        </div>

        <div className="border-t border-blue-800/40 pt-2 sm:pt-2.5 pb-4 sm:pb-4.5">
          <nav className="flex overflow-x-auto scrollbar-hide">
            <ul className="flex space-x-6 sm:space-x-8 md:space-x-10">
              <NavLink href="/">Faculty</NavLink>
              <NavLink href="/about">About</NavLink>
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
