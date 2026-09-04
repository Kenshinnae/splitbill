import { ImageResponse } from "next/og";

/** Coin-style SplitBill mark: gold coin + SB. */
export function splitBillIconMarkup(fontSize: number) {
  const rim = Math.max(2, Math.round(fontSize * 0.12));
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
      }}
    >
      <div
        style={{
          width: "82%",
          height: "82%",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(145deg, #fde68a 0%, #f59e0b 45%, #d97706 100%)",
          border: `${rim}px solid #b45309`,
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.35)",
        }}
      >
        <div
          style={{
            width: "78%",
            height: "78%",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `${Math.max(1, Math.round(rim * 0.7))}px solid rgba(120,53,15,0.35)`,
            color: "#78350f",
            fontSize,
            fontWeight: 800,
            letterSpacing: "-0.06em",
          }}
        >
          SB
        </div>
      </div>
    </div>
  );
}

export function splitBillIconResponse(size: number) {
  const fontSize = Math.round(size * 0.34);
  return new ImageResponse(splitBillIconMarkup(fontSize), {
    width: size,
    height: size,
  });
}
