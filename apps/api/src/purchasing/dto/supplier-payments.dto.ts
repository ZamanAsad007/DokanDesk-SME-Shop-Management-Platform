import {
  createSupplierPaymentSchema,
  supplierPaymentQuerySchema,
} from '@dokandesk/shared';
import type {
  CreateSupplierPaymentInput,
  SupplierPaymentQueryInput,
} from '@dokandesk/shared';

export { createSupplierPaymentSchema, supplierPaymentQuerySchema };
export type { CreateSupplierPaymentInput, SupplierPaymentQueryInput };
export type CreateSupplierPaymentDto = CreateSupplierPaymentInput;
