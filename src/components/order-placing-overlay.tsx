import { CheckCircle2, CookingPot, ReceiptText } from "lucide-react";

export function OrderPlacingOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-white/82 px-6 backdrop-blur-md" role="status" aria-live="polite">
      <div className="wt-order-card w-full max-w-[315px] rounded-[26px] bg-white p-6 text-center shadow-[0_24px_70px_rgba(34,31,32,0.22)] ring-1 ring-[#f1dce1]">
        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          <span className="absolute inset-0 rounded-full bg-[#fff4f5] wt-order-pulse" />
          <span className="absolute inset-3 rounded-full border border-[#f1dce1] bg-white" />
          <CookingPot className="relative z-10 text-maroon wt-order-float" size={39} strokeWidth={2.5} />
          <CheckCircle2 className="absolute bottom-2 right-2 z-20 rounded-full bg-white text-maroon wt-order-pop" size={28} strokeWidth={3} />
        </div>
        <h2 className="mt-5 text-[22px] font-black leading-tight text-maroon">Placing your order</h2>
        <p className="mt-2 text-sm font-bold leading-5 text-muted">{message}</p>
        <div className="mt-5 overflow-hidden rounded-full bg-[#f7e7eb]">
          <div className="h-2 rounded-full bg-maroon wt-order-progress" />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-[11px] font-black text-muted">
          <span className="rounded-xl bg-[#fff4f5] py-2 text-maroon">Saved</span>
          <span className="rounded-xl bg-[#f6f7fb] py-2">Kitchen</span>
          <span className="rounded-xl bg-[#f6f7fb] py-2">Track</span>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#f6f7fb] px-3 py-2 text-[12px] font-black text-charcoal">
          <ReceiptText size={15} className="text-maroon" /> Opening live order details
        </div>
      </div>
    </div>
  );
}
