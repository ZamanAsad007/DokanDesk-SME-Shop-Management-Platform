/**
 * Money Helpers for DokanDesk
 * All monetary amounts are represented as integer Paisa (1 Taka = 100 Paisa).
 * Floating-point representation for money in databases and ledgers is strictly prohibited.
 */

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/**
 * Validates that a paisa value is a safe integer.
 */
export function assertIntegerPaisa(paisa: number, paramName = 'amount'): void {
  if (typeof paisa !== 'number' || !Number.isInteger(paisa)) {
    throw new MoneyError(
      `Invalid money value for ${paramName}: expected integer paisa, received ${paisa}`,
    );
  }
  if (!Number.isSafeInteger(paisa)) {
    throw new MoneyError(`Integer overflow for ${paramName}: ${paisa}`);
  }
}

/**
 * Converts a decimal monetary amount (e.g., 10.50) to integer paisa (1050).
 */
export function toPaisa(decimalAmount: number | string): number {
  if (typeof decimalAmount === 'string') {
    const trimmed = decimalAmount.trim();
    if (trimmed === '' || isNaN(Number(trimmed))) {
      throw new MoneyError(`Cannot parse "${decimalAmount}" to monetary paisa`);
    }
    decimalAmount = parseFloat(trimmed);
  }

  if (typeof decimalAmount !== 'number' || !Number.isFinite(decimalAmount)) {
    throw new MoneyError(`Invalid decimal amount: ${decimalAmount}`);
  }

  // Math.round avoids IEEE 754 float precision drift (e.g. 19.99 * 100 = 1998.9999999999998)
  const paisa = Math.round(decimalAmount * 100);
  assertIntegerPaisa(paisa, 'converted paisa');
  return paisa;
}

/**
 * Converts integer paisa (e.g., 1050) to a decimal number (10.50) for display purposes.
 */
export function fromPaisa(paisa: number): number {
  assertIntegerPaisa(paisa);
  return paisa / 100;
}

/**
 * Formats integer paisa to a standard localized string.
 * e.g., 125050 -> "1,250.50"
 */
export function formatPaisa(
  paisa: number,
  options: { currencySymbol?: string; showCurrency?: boolean } = {},
): string {
  assertIntegerPaisa(paisa);
  const { currencySymbol = '৳', showCurrency = true } = options;
  const isNegative = paisa < 0;
  const absolutePaisa = Math.abs(paisa);

  const major = Math.floor(absolutePaisa / 100);
  const minor = (absolutePaisa % 100).toString().padStart(2, '0');

  const formattedMajor = major.toLocaleString('en-US');
  const sign = isNegative ? '-' : '';
  const amountStr = `${sign}${formattedMajor}.${minor}`;

  return showCurrency ? `${currencySymbol}${amountStr}` : amountStr;
}

/**
 * Safely adds multiple integer paisa values.
 */
export function addPaisa(...amounts: number[]): number {
  let sum = 0;
  for (const amount of amounts) {
    assertIntegerPaisa(amount);
    sum += amount;
    assertIntegerPaisa(sum, 'accumulated sum');
  }
  return sum;
}

/**
 * Safely subtracts paisa (minuend - subtrahend).
 */
export function subtractPaisa(minuend: number, subtrahend: number): number {
  assertIntegerPaisa(minuend, 'minuend');
  assertIntegerPaisa(subtrahend, 'subtrahend');
  const diff = minuend - subtrahend;
  assertIntegerPaisa(diff, 'difference');
  return diff;
}

/**
 * Multiplies unit price in paisa by a quantity (e.g. 3.5 kg * 120.00 tk).
 * Rounds to the nearest integer paisa using half-up rounding.
 */
export function multiplyPaisaByQty(unitPaisa: number, quantity: number): number {
  assertIntegerPaisa(unitPaisa, 'unit price');
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0) {
    throw new MoneyError(`Invalid quantity: ${quantity}`);
  }
  const total = Math.round(unitPaisa * quantity);
  assertIntegerPaisa(total, 'multiplied total');
  return total;
}

/**
 * Calculates percentage discount on an amount in paisa.
 * Returns integer paisa discount (capped at totalPaisa).
 */
export function calculatePercentageDiscount(totalPaisa: number, discountPercent: number): number {
  assertIntegerPaisa(totalPaisa, 'totalPaisa');
  if (
    typeof discountPercent !== 'number' ||
    !Number.isFinite(discountPercent) ||
    discountPercent < 0 ||
    discountPercent > 100
  ) {
    throw new MoneyError(`Discount percentage must be between 0 and 100, received ${discountPercent}`);
  }
  const discount = Math.round((totalPaisa * discountPercent) / 100);
  return Math.min(totalPaisa, discount);
}

/**
 * Calculates VAT/Tax on a subtotal in paisa.
 * Returns integer paisa VAT.
 */
export function calculateVatAmount(subtotalPaisa: number, vatPercent: number): number {
  assertIntegerPaisa(subtotalPaisa, 'subtotalPaisa');
  if (typeof vatPercent !== 'number' || !Number.isFinite(vatPercent) || vatPercent < 0) {
    throw new MoneyError(`VAT percentage must be non-negative, received ${vatPercent}`);
  }
  const vat = Math.round((subtotalPaisa * vatPercent) / 100);
  assertIntegerPaisa(vat, 'vat amount');
  return vat;
}
