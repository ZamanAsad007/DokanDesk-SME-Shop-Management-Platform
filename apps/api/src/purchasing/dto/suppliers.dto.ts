import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierQuerySchema,
} from '@dokandesk/shared';
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierQueryInput,
} from '@dokandesk/shared';

export { createSupplierSchema, updateSupplierSchema, supplierQuerySchema };
export type { CreateSupplierInput, UpdateSupplierInput, SupplierQueryInput };
export type CreateSupplierDto = CreateSupplierInput;
export type UpdateSupplierDto = UpdateSupplierInput;
