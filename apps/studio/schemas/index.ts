import type { SchemaTypeDefinition } from "sanity";
import { propertyType } from "./property.js";
import { realEstateCompanyType } from "./realEstateCompany.js";

/**
 * Sanity スキーマのエントリポイント。
 * Issue #5〜#7 で各ドキュメントタイプを順次追加する。
 */
export const schemaTypes: ReadonlyArray<SchemaTypeDefinition> = [
  propertyType,
  realEstateCompanyType,
];
