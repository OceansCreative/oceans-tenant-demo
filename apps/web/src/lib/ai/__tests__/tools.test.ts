import { propertySchema, searchCriteriaSchema } from "@oceans-tenant/shared";
import { describe, expect, it } from "vitest";
import {
  EXTRACT_PROPERTY_TOOL_NAME,
  extractPropertyTool,
  UPDATE_CRITERIA_TOOL_NAME,
  updateCriteriaTool,
  zodToToolInputSchema,
} from "@/lib/ai/tools";

/**
 * Tool 定義は Anthropic Messages API の `tools` パラメータに直接渡される。
 * 仕様: input_schema は top-level が `type: "object"` であること、
 * `$schema` フィールドを含まないこと。
 */
describe("zodToToolInputSchema", () => {
  it("propertySchema の出力は type: object である", () => {
    const schema = zodToToolInputSchema(propertySchema);
    expect(schema.type).toBe("object");
  });

  it("$schema フィールドを含まない", () => {
    const schema = zodToToolInputSchema(propertySchema) as Record<string, unknown>;
    expect(schema.$schema).toBeUndefined();
  });

  it("searchCriteriaSchema からも生成できる", () => {
    const schema = zodToToolInputSchema(searchCriteriaSchema) as Record<string, unknown> & {
      properties?: Record<string, unknown>;
    };
    expect(schema.type).toBe("object");
    expect(schema.properties).toBeDefined();
  });

  it("生成結果が JSON シリアライズ可能（循環参照を含まない）", () => {
    const schema = zodToToolInputSchema(propertySchema);
    expect(() => JSON.stringify(schema)).not.toThrow();
  });
});

describe("Tool 定義", () => {
  it("extractPropertyTool は name と input_schema を持つ", () => {
    expect(extractPropertyTool.name).toBe(EXTRACT_PROPERTY_TOOL_NAME);
    expect(extractPropertyTool.input_schema.type).toBe("object");
    expect(extractPropertyTool.description.length).toBeGreaterThan(0);
  });

  it("updateCriteriaTool は message を required で含む", () => {
    expect(updateCriteriaTool.name).toBe(UPDATE_CRITERIA_TOOL_NAME);
    expect(updateCriteriaTool.input_schema.type).toBe("object");
    expect(updateCriteriaTool.input_schema.required).toContain("message");
  });

  it("updateCriteriaTool の criteria は searchCriteria 互換のネスト object schema", () => {
    const properties = updateCriteriaTool.input_schema.properties as Record<string, unknown>;
    const criteria = properties.criteria as Record<string, unknown>;
    expect(criteria.type).toBe("object");
  });
});
