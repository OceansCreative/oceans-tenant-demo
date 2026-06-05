"use client";

import {
  type Availability,
  availabilityValues,
  type BuildingType,
  buildingTypeValues,
  type Condition,
  conditionValues,
  type Prefecture,
  type Property,
  prefectureValues,
} from "@oceans-tenant/shared";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

/**
 * 物件編集 / 新規作成フォーム（Client Component）。
 *
 * 設計判断:
 * - **state 管理は `useState` のみ**: React Hook Form / Formik を導入せず、依存を増やさない。
 *   各フィールドは個別 state で持ち、`buildPayload()` で送信時に Property 形状に組み立てる。
 *   既存 `propertySchema` で server-side 検証されるため、client 側は最低限の `required` 属性のみ。
 * - **mode は initial の有無で判定**: `initial` が undefined なら新規、定義済みなら編集。slug は新規時のみ編集可。
 * - **a11y**: 各 `<input>` に `<label htmlFor>` を紐付け、エラーは `aria-describedby` で関連付ける。
 *   フィールド側エラーは server-side の fieldErrors を反映する想定。
 * - **送信ハンドラ**: `fetch('/api/admin/property', { method: 'POST' })` → 成功時 `router.refresh()` で一覧を再描画 → `router.push('/admin')` で戻る。
 * - **削除**: 編集時のみ表示。`window.confirm` で確認後 DELETE → 一覧に戻る。
 */

type PropertyEditFormProps = {
  /** undefined なら新規作成モード、Property が渡れば編集モード */
  readonly initial?: Property;
};

type SubmitResult =
  | { readonly kind: "idle" }
  | { readonly kind: "pending" }
  | { readonly kind: "ok"; readonly mode: "sanity" | "mock" }
  | { readonly kind: "error"; readonly message: string };

const DEFAULT_PREFECTURE: Prefecture = "東京都";

const buildDefaultPublishedAt = (): string => new Date().toISOString();

export const PropertyEditForm = ({ initial }: PropertyEditFormProps): React.JSX.Element => {
  const t = useTranslations("admin");
  const tFields = useTranslations("admin.fields");
  const tPlaceholders = useTranslations("admin.placeholders");
  const tEnumBuilding = useTranslations("enum.buildingType");
  const tEnumCondition = useTranslations("enum.condition");
  const tEnumAvailability = useTranslations("enum.availability");
  const router = useRouter();

  const isEdit = initial !== undefined;
  const idPrefix = useId();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [prefecture, setPrefecture] = useState<Prefecture>(
    initial?.address.prefecture ?? DEFAULT_PREFECTURE,
  );
  const [city, setCity] = useState(initial?.address.city ?? "");
  const [streetAddress, setStreetAddress] = useState(initial?.address.streetAddress ?? "");
  const [geoLat, setGeoLat] = useState<string>(String(initial?.address.geopoint.lat ?? "35.6812"));
  const [geoLng, setGeoLng] = useState<string>(String(initial?.address.geopoint.lng ?? "139.7671"));
  const [rent, setRent] = useState<string>(String(initial?.rent ?? "0"));
  const [area, setArea] = useState<string>(String(initial?.area ?? "10"));
  const [buildingType, setBuildingType] = useState<BuildingType | "">(initial?.buildingType ?? "");
  const [condition, setCondition] = useState<Condition | "">(initial?.condition ?? "");
  const [availability, setAvailability] = useState<Availability>(initial?.availability ?? "public");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [listedByRef, setListedByRef] = useState(initial?.listedByRef ?? "company-001");
  const [publishedAt, setPublishedAt] = useState(initial?.publishedAt ?? buildDefaultPublishedAt());

  const [submitState, setSubmitState] = useState<SubmitResult>({ kind: "idle" });

  const buildPayload = (): Record<string, unknown> => ({
    title,
    slug,
    address: {
      prefecture,
      city,
      ...(streetAddress ? { streetAddress } : {}),
      geopoint: { lat: Number(geoLat), lng: Number(geoLng) },
    },
    nearestStations: initial?.nearestStations ?? [],
    rent: Number(rent),
    area: Number(area),
    ...(buildingType ? { buildingType } : {}),
    ...(condition ? { condition } : {}),
    suitableBusinessRefs: initial?.suitableBusinessRefs ?? [],
    images: initial?.images ?? [],
    ...(description ? { description } : {}),
    features: initial?.features ?? [],
    availability,
    listedByRef,
    aiMeta: initial?.aiMeta ?? { aiExtracted: false },
    publishedAt,
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitState({ kind: "pending" });
    try {
      const response = await fetch("/api/admin/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = (await response.json()) as
        | { status: "ok"; mode: "sanity" | "mock" }
        | { status: "error"; error: string };
      if (!response.ok || data.status !== "ok") {
        const message = data.status === "error" ? data.error : t("saveFailed");
        setSubmitState({ kind: "error", message });
        return;
      }
      setSubmitState({ kind: "ok", mode: data.mode });
      router.refresh();
      router.push("/admin");
    } catch (error) {
      setSubmitState({
        kind: "error",
        message: error instanceof Error ? error.message : t("errors.submitFailed"),
      });
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!initial) return;
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(t("confirmDelete", { title: initial.title }));
    if (!confirmed) return;
    setSubmitState({ kind: "pending" });
    try {
      const response = await fetch(`/api/admin/property?slug=${encodeURIComponent(initial.slug)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as
        | { status: "ok"; mode: "sanity" | "mock" }
        | { status: "error"; error: string };
      if (!response.ok || data.status !== "ok") {
        const message = data.status === "error" ? data.error : t("deleteFailed");
        setSubmitState({ kind: "error", message });
        return;
      }
      setSubmitState({ kind: "ok", mode: data.mode });
      router.refresh();
      router.push("/admin");
    } catch (error) {
      setSubmitState({
        kind: "error",
        message: error instanceof Error ? error.message : t("deleteFailed"),
      });
    }
  };

  const pending = submitState.kind === "pending";

  const fieldId = (key: string): string => `${idPrefix}-${key}`;

  const errorBoxId = `${idPrefix}-error`;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
      aria-describedby={submitState.kind === "error" ? errorBoxId : undefined}
      data-testid="property-edit-form"
    >
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-neutral-900">
          {isEdit ? t("editTitle") : t("createTitle")}
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm" htmlFor={fieldId("title")}>
            <span className="font-medium text-neutral-800">{tFields("title")}</span>
            <input
              id={fieldId("title")}
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tPlaceholders("title")}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </label>

          <div className="space-y-1 text-sm">
            <label className="block space-y-1" htmlFor={fieldId("slug")}>
              <span className="font-medium text-neutral-800">{tFields("slug")}</span>
              <input
                id={fieldId("slug")}
                type="text"
                required
                pattern="[a-z0-9-]+"
                value={slug}
                disabled={isEdit}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={tPlaceholders("slug")}
                aria-describedby={fieldId("slug-hint")}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-neutral-100"
              />
            </label>
            <p id={fieldId("slug-hint")} className="text-xs text-neutral-500">
              {tFields("slugHint")}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1 text-sm" htmlFor={fieldId("prefecture")}>
            <span className="font-medium text-neutral-800">{tFields("prefecture")}</span>
            <select
              id={fieldId("prefecture")}
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value as Prefecture)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {prefectureValues.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm" htmlFor={fieldId("city")}>
            <span className="font-medium text-neutral-800">{tFields("city")}</span>
            <input
              id={fieldId("city")}
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={tPlaceholders("city")}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </label>

          <label className="space-y-1 text-sm" htmlFor={fieldId("streetAddress")}>
            <span className="font-medium text-neutral-800">{tFields("streetAddress")}</span>
            <input
              id={fieldId("streetAddress")}
              type="text"
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              placeholder={tPlaceholders("streetAddress")}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm" htmlFor={fieldId("geoLat")}>
            <span className="font-medium text-neutral-800">{tFields("geoLat")}</span>
            <input
              id={fieldId("geoLat")}
              type="number"
              required
              step="any"
              min={20}
              max={46}
              value={geoLat}
              onChange={(e) => setGeoLat(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </label>
          <label className="space-y-1 text-sm" htmlFor={fieldId("geoLng")}>
            <span className="font-medium text-neutral-800">{tFields("geoLng")}</span>
            <input
              id={fieldId("geoLng")}
              type="number"
              required
              step="any"
              min={122}
              max={154}
              value={geoLng}
              onChange={(e) => setGeoLng(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1 text-sm" htmlFor={fieldId("rent")}>
            <span className="font-medium text-neutral-800">{tFields("rent")}</span>
            <input
              id={fieldId("rent")}
              type="number"
              required
              min={0}
              step={1}
              value={rent}
              onChange={(e) => setRent(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </label>
          <label className="space-y-1 text-sm" htmlFor={fieldId("area")}>
            <span className="font-medium text-neutral-800">{tFields("area")}</span>
            <input
              id={fieldId("area")}
              type="number"
              required
              min={0}
              step="any"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </label>
          <label className="space-y-1 text-sm" htmlFor={fieldId("availability")}>
            <span className="font-medium text-neutral-800">{tFields("availability")}</span>
            <select
              id={fieldId("availability")}
              value={availability}
              onChange={(e) => setAvailability(e.target.value as Availability)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {availabilityValues.map((value) => (
                <option key={value} value={value}>
                  {tEnumAvailability(value)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm" htmlFor={fieldId("buildingType")}>
            <span className="font-medium text-neutral-800">{tFields("buildingType")}</span>
            <select
              id={fieldId("buildingType")}
              value={buildingType}
              onChange={(e) => setBuildingType(e.target.value as BuildingType | "")}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value="">{tPlaceholders("any")}</option>
              {buildingTypeValues.map((value) => (
                <option key={value} value={value}>
                  {tEnumBuilding(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm" htmlFor={fieldId("condition")}>
            <span className="font-medium text-neutral-800">{tFields("condition")}</span>
            <select
              id={fieldId("condition")}
              value={condition}
              onChange={(e) => setCondition(e.target.value as Condition | "")}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value="">{tPlaceholders("any")}</option>
              {conditionValues.map((value) => (
                <option key={value} value={value}>
                  {tEnumCondition(value)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1 text-sm" htmlFor={fieldId("description")}>
          <span className="font-medium text-neutral-800">{tFields("description")}</span>
          <textarea
            id={fieldId("description")}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tPlaceholders("description")}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm" htmlFor={fieldId("listedByRef")}>
            <span className="font-medium text-neutral-800">{tFields("listedByRef")}</span>
            <input
              id={fieldId("listedByRef")}
              type="text"
              required
              value={listedByRef}
              onChange={(e) => setListedByRef(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </label>
          <label className="space-y-1 text-sm" htmlFor={fieldId("publishedAt")}>
            <span className="font-medium text-neutral-800">{tFields("publishedAt")}</span>
            <input
              id={fieldId("publishedAt")}
              type="text"
              required
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-mono shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </label>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {t("save")}
        </button>
        {isEdit ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-full border border-red-200 px-5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {t("delete")}
          </button>
        ) : null}
      </div>

      <div aria-live="polite" className="min-h-[1.5rem] text-sm">
        {submitState.kind === "ok" ? (
          <p className="text-emerald-700">
            {t("saveSuccess", { mode: submitState.mode })}{" "}
            <span className="text-xs text-neutral-500">
              ({submitState.mode === "sanity" ? t("modeSanity") : t("modeMock")})
            </span>
          </p>
        ) : null}
        {submitState.kind === "error" ? (
          <p id={errorBoxId} className="text-red-700">
            {t("saveFailed")}: {submitState.message}
          </p>
        ) : null}
      </div>
    </form>
  );
};
