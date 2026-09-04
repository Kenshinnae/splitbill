const fmt = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
});

export function formatMoney(amount: number): string {
  return fmt.format(amount);
}
