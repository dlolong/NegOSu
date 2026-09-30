/** Exact quantities in native product units. No packaging conversions are inferred. */
export function quantityThousandths(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(value)) throw new Error("Enter a positive quantity with at most three decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const result = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
  if (result <= 0n) throw new Error("Quantity must be greater than zero.");
  return result;
}

export function quantityAmountCentavos(quantity: string, unitPriceCentavos: bigint): bigint {
  if (unitPriceCentavos < 0n) throw new Error("Price must not be negative.");
  // Positive commercial amounts round half up to the nearest minor unit.
  return (quantityThousandths(quantity) * unitPriceCentavos + 500n) / 1000n;
}
