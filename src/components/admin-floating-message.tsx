import { CheckCircle2, Info, XCircle } from "lucide-react";

type AdminFloatingMessageTone = "success" | "error" | "info";

export function AdminFloatingMessage({ message, tone = "info" }: { message: string; tone?: AdminFloatingMessageTone }) {
  const isSuccess = tone === "success";
  const isError = tone === "error";
  const Icon = isSuccess ? CheckCircle2 : isError ? XCircle : Info;

  return (
    <div
      className={`fixed bottom-4 right-4 z-[80] flex max-w-[min(440px,calc(100vw-32px))] items-start gap-3 rounded-lg border px-4 py-3 text-sm font-black shadow-[0_18px_42px_rgba(34,31,32,0.16)] ${
        isSuccess
          ? "border-[#bfe7cf] bg-[#effaf4] text-[#0f7a45]"
          : isError
            ? "border-[#ffd1d6] bg-[#fff4f5] text-red"
            : "border-border bg-cream text-maroon"
      }`}
      role="status"
      aria-live="polite"
    >
      <Icon className="mt-0.5 shrink-0" size={18} />
      <span className="whitespace-pre-line leading-5">{message}</span>
    </div>
  );
}
