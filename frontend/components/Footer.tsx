/** Shared workspace footer keeps every authenticated page visually complete. */
export default function Footer() {
  return (
    <footer className="mt-8 border-t border-slate-200 pt-5 text-center text-xs text-slate-500 sm:text-left">
      © {new Date().getFullYear()} Smart Tasks · Plan work. Make progress.
    </footer>
  );
}
