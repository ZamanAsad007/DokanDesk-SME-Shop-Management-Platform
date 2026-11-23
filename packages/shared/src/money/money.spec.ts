import { describe, it, expect } from 'vitest';
import {
  toPaisa,
  fromPaisa,
  formatPaisa,
  addPaisa,
  subtractPaisa,
  multiplyPaisaByQty,
  calculatePercentageDiscount,
  calculateVatAmount,
  assertIntegerPaisa,
  MoneyError,
} from './money.js';

describe('Money Helpers (Integer Paisa)', () => {
  describe('toPaisa', () => {
    it('converts decimal number to integer paisa correctly', () => {
      expect(toPaisa(10.5)).toBe(1050);
      expect(toPaisa(0)).toBe(0);
      expect(toPaisa(19.99)).toBe(1999);
      expect(toPaisa(0.01)).toBe(1);
      expect(toPaisa(100)).toBe(10000);
    });

    it('converts string representation to integer paisa', () => {
      expect(toPaisa('10.50')).toBe(1050);
      expect(toPaisa('0.99')).toBe(99);
      expect(toPaisa(' 250 ')).toBe(25000);
    });

    it('throws MoneyError on invalid inputs', () => {
      expect(() => toPaisa('invalid')).toThrow(MoneyError);
      expect(() => toPaisa(NaN)).toThrow(MoneyError);
      expect(() => toPaisa(Infinity)).toThrow(MoneyError);
    });
  });

  describe('fromPaisa', () => {
    it('converts integer paisa to decimal amount', () => {
      expect(fromPaisa(1050)).toBe(10.5);
      expect(fromPaisa(99)).toBe(0.99);
      expect(fromPaisa(0)).toBe(0);
    });

    it('rejects non-integer paisa input', () => {
      expect(() => fromPaisa(10.5)).toThrow(MoneyError);
    });
  });

  describe('formatPaisa', () => {
    it('formats paisa to formatted currency string', () => {
      expect(formatPaisa(1050)).toBe('৳10.50');
      expect(formatPaisa(125050)).toBe('৳1,250.50');
      expect(formatPaisa(0)).toBe('৳0.00');
      expect(formatPaisa(5)).toBe('৳0.05');
    });

    it('supports custom symbol and currency visibility', () => {
      expect(formatPaisa(1050, { currencySymbol: '$' })).toBe('$10.50');
      expect(formatPaisa(1050, { showCurrency: false })).toBe('10.50');
    });

    it('formats negative values correctly', () => {
      expect(formatPaisa(-1050)).toBe('৳-10.50');
    });
  });

  describe('addPaisa and subtractPaisa', () => {
    it('accurately adds multiple paisa amounts without float errors', () => {
      const sum = addPaisa(1000, 2050, 3045);
      expect(sum).toBe(6095);
    });

    it('subtracts paisa accurately', () => {
      expect(subtractPaisa(5000, 1500)).toBe(3500);
    });

    it('rejects floating point numbers', () => {
      expect(() => addPaisa(10.5, 20)).toThrow(MoneyError);
      expect(() => subtractPaisa(100, 20.5)).toThrow(MoneyError);
    });
  });

  describe('multiplyPaisaByQty', () => {
    it('calculates total for integer quantity', () => {
      expect(multiplyPaisaByQty(1000, 3)).toBe(3000);
    });

    it('calculates total for decimal quantity with proper rounding', () => {
      // 120.00 tk/kg * 2.5 kg = 300.00 tk
      expect(multiplyPaisaByQty(12000, 2.5)).toBe(30000);
      // 33.33 tk * 1.5 = 49.995 -> 50.00 tk
      expect(multiplyPaisaByQty(3333, 1.5)).toBe(5000);
    });

    it('rejects negative quantity', () => {
      expect(() => multiplyPaisaByQty(1000, -1)).toThrow(MoneyError);
    });
  });

  describe('calculatePercentageDiscount', () => {
    it('calculates correct percentage discount', () => {
      // 10% of 1000 tk (100000 paisa) = 100 tk (10000 paisa)
      expect(calculatePercentageDiscount(100000, 10)).toBe(10000);
      // 15% of 19.99 tk (1999 paisa) = 299.85 -> 300 paisa (3.00 tk)
      expect(calculatePercentageDiscount(1999, 15)).toBe(300);
    });

    it('caps discount at total paisa', () => {
      expect(calculatePercentageDiscount(1000, 100)).toBe(1000);
    });

    it('rejects invalid percentage', () => {
      expect(() => calculatePercentageDiscount(1000, -5)).toThrow(MoneyError);
      expect(() => calculatePercentageDiscount(1000, 105)).toThrow(MoneyError);
    });
  });

  describe('calculateVatAmount', () => {
    it('calculates VAT in integer paisa', () => {
      // 5% VAT on 100.00 tk (10000 paisa) = 500 paisa (5.00 tk)
      expect(calculateVatAmount(10000, 5)).toBe(500);
      // 7.5% VAT on 125.00 tk (12500 paisa) = 937.5 -> 938 paisa (9.38 tk)
      expect(calculateVatAmount(12500, 7.5)).toBe(938);
    });
  });

  describe('assertIntegerPaisa', () => {
    it('passes for safe integers and fails for floats/NaN', () => {
      expect(() => assertIntegerPaisa(100)).not.toThrow();
      expect(() => assertIntegerPaisa(0)).not.toThrow();
      expect(() => assertIntegerPaisa(10.5)).toThrow(MoneyError);
      expect(() => assertIntegerPaisa(NaN)).toThrow(MoneyError);
    });
  });
});
