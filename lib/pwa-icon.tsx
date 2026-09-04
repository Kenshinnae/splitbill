import { ImageResponse } from "next/og";

export function splitBillIconMarkup(fontSize: number) {
  return (
    <div
      style={{
        fontSize,
        background: "linear-gradient(145deg, #059669 0%, #047857 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: 700,
        letterSpacing: "-0.04em",
        borderRadius: "22%",
      }}
    >
      SB
    </div>
  );
}

export function splitBillIconResponse(size: number) {
  const fontSize = Math.round(size * 0.42);
  return new ImageResponse(splitBillIconMarkup(fontSize), {
    width: size,
    height: size,
  });
}
