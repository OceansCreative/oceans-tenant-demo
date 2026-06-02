"use client";

import { sanityConfig } from "@oceans-tenant/studio/sanity.config";
import { NextStudio } from "next-sanity/studio";

/**
 * `NextStudio` を Client Component として包む薄いラッパー。
 *
 * `NextStudio` は Sanity Studio v3 の React アプリ全体をマウントする CSR コンポーネント。
 * Sanity のスキーマや plugin は内部で React の `createContext` を使うため、
 * Server Component から `sanityConfig` を import すると build 時に
 * `createContext is not a function` で失敗する。これを避けるため
 * `sanityConfig` の import 自体を Client Component 内に閉じ込めている。
 */
export const StudioClient = (): React.JSX.Element => <NextStudio config={sanityConfig} />;
