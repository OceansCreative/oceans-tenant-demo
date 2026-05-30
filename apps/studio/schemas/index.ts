import type { SchemaTypeDefinition } from "sanity";
import { areaType } from "./area.js";
import { businessCategoryType } from "./businessCategory.js";
import { propertyType } from "./property.js";
import { realEstateCompanyType } from "./realEstateCompany.js";
import { searchSessionType } from "./searchSession.js";

/**
 * Sanity スキーマのエントリポイント。
 * Phase 1 で必要な 5 ドキュメントタイプを登録する。
 */
export const schemaTypes: ReadonlyArray<SchemaTypeDefinition> = [
  propertyType,
  realEstateCompanyType,
  businessCategoryType,
  areaType,
  searchSessionType,
];
