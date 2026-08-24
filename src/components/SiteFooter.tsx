import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="bg-lums-navy-dark text-white/70 text-sm mt-auto">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-2">
        <p>&copy; {new Date().getFullYear()} RateDeezSlum</p>
        <div className="flex items-center gap-4">
          <p>Anonymous student reviews. Not affiliated with LUMS.</p>
          <Link href="/about" className="hover:text-lums-gold transition-colors">
            About
          </Link>
          <Link href="/privacy" className="hover:text-lums-gold transition-colors">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
