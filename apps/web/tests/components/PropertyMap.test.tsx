import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

// @vis.gl/react-google-maps を軽量モックして API キーありの分岐に到達できるようにする。
// 実 SDK は jsdom 環境で動かないため、必要な named export を最小限のスタブに置き換える。
// `useMap` はクラスタリングの分岐到達確認のため、ダミーの map オブジェクトを返す。
const mockMapInstance = { id: "mock-map" };
vi.mock("@vis.gl/react-google-maps", () => {
  type RC = { readonly children?: React.ReactNode };
  const APIProvider = ({ children }: RC) => <div data-testid="api-provider">{children}</div>;
  const GoogleMapStub = ({ children }: RC) => <div data-testid="google-map">{children}</div>;
  // AdvancedMarker は ref callback を介して MarkerClusterer に登録される。
  // テストではダミー element を ref に渡して registerMarker の動作を確認する。
  const AdvancedMarker = ({
    children,
    onClick,
    ref,
  }: RC & {
    readonly onClick?: () => void;
    readonly ref?: (el: object | null) => void;
  }) => {
    if (ref) {
      // 即時に擬似 element を渡す（実 SDK の AdvancedMarkerElement の代替）
      queueMicrotask(() => ref({ slug: "mock-marker-element" }));
    }
    return (
      <button type="button" data-testid="marker" onClick={onClick}>
        {children}
      </button>
    );
  };
  const InfoWindow = ({ children }: RC) => <div data-testid="info-window">{children}</div>;
  const Pin = () => <span data-testid="pin" />;
  const useMap = () => mockMapInstance;
  return { APIProvider, Map: GoogleMapStub, AdvancedMarker, InfoWindow, Pin, useMap };
});

// MarkerClusterer は実 google.maps API を要求するため、生成・破棄を spy で観測するだけのスタブに置き換える。
const clustererCalls = vi.hoisted(() => ({
  constructed: 0,
  cleared: 0,
  unmounted: 0,
}));
vi.mock("@googlemaps/markerclusterer", () => {
  class MarkerClusterer {
    constructor(_opts: unknown) {
      clustererCalls.constructed += 1;
    }
    clearMarkers(): void {
      clustererCalls.cleared += 1;
    }
    onRemove(): void {
      clustererCalls.unmounted += 1;
    }
  }
  return { MarkerClusterer };
});

const ORIGINAL_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

beforeEach(() => {
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = undefined;
  clustererCalls.constructed = 0;
  clustererCalls.cleared = 0;
  clustererCalls.unmounted = 0;
});

afterEach(() => {
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = ORIGINAL_KEY;
});

describe("PropertyMap", () => {
  it("API キー未設定のとき無効化メッセージを描画する", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "";
    const { PropertyMap } = await import("@/components/map/PropertyMap");
    render(<PropertyMap properties={MOCK_PROPERTIES} />);
    expect(screen.getByText("地図ビューは無効化されています")).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`現在 ${MOCK_PROPERTIES.length} 件の物件がマップ表示候補`)),
    ).toBeInTheDocument();
  });

  it("properties が空配列のとき件数 0 が表示される", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "";
    const { PropertyMap } = await import("@/components/map/PropertyMap");
    render(<PropertyMap properties={[]} />);
    expect(screen.getByText(/現在 0 件の物件がマップ表示候補/)).toBeInTheDocument();
  });

  it("aria-label が「地図ビュー（無効化）」", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "";
    const { PropertyMap } = await import("@/components/map/PropertyMap");
    render(<PropertyMap properties={[]} />);
    expect(screen.getByRole("region", { name: "地図ビュー（無効化）" })).toBeInTheDocument();
  });

  it("追加クラスを併合できる（無効化時）", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "";
    const { PropertyMap } = await import("@/components/map/PropertyMap");
    const { container } = render(<PropertyMap properties={[]} className="custom-cls" />);
    const section = container.querySelector("section");
    expect(section?.className).toMatch(/custom-cls/);
  });

  it("API キーあり時は GoogleMap と マーカーを描画する", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "dummy-key";
    const { PropertyMap } = await import("@/components/map/PropertyMap");
    render(<PropertyMap properties={MOCK_PROPERTIES} />);
    expect(screen.getByTestId("api-provider")).toBeInTheDocument();
    expect(screen.getByTestId("google-map")).toBeInTheDocument();
    const markers = screen.getAllByTestId("marker");
    expect(markers.length).toBe(MOCK_PROPERTIES.length);
  });

  it("マーカーをクリックすると InfoWindow に物件タイトルが表示される", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "dummy-key";
    const { PropertyMap } = await import("@/components/map/PropertyMap");
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();
    render(<PropertyMap properties={MOCK_PROPERTIES} />);
    const firstMarker = screen.getAllByTestId("marker")[0];
    if (!firstMarker) throw new Error("expected at least one marker");
    await user.click(firstMarker);
    expect(screen.getByTestId("info-window")).toBeInTheDocument();
    const first = MOCK_PROPERTIES[0];
    if (!first) throw new Error("expected at least one property");
    expect(screen.getByText(first.title)).toBeInTheDocument();
  });

  it("CLUSTERING_THRESHOLD は 10 件以上で発動する閾値", async () => {
    const { CLUSTERING_THRESHOLD } = await import("@/components/map/PropertyMap");
    expect(CLUSTERING_THRESHOLD).toBe(10);
  });

  it("物件数が 10 件未満のときクラスタリングは無効化される（data-clustering=disabled）", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "dummy-key";
    const { PropertyMap } = await import("@/components/map/PropertyMap");
    const { container } = render(<PropertyMap properties={MOCK_PROPERTIES.slice(0, 5)} />);
    const wrapper = container.querySelector("[data-clustering]");
    expect(wrapper?.getAttribute("data-clustering")).toBe("disabled");
    // MarkerClusterer は 1 回も生成されない
    expect(clustererCalls.constructed).toBe(0);
  });

  it("物件数が 10 件以上のときクラスタリングが有効化される（data-clustering=enabled）", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "dummy-key";
    const { PropertyMap } = await import("@/components/map/PropertyMap");
    // mock 5 件を repeat して 10 件超の配列を作る
    const many = [...MOCK_PROPERTIES, ...MOCK_PROPERTIES].map((p, i) => ({
      ...p,
      slug: `${p.slug}-${i}`,
    }));
    expect(many.length).toBeGreaterThanOrEqual(10);
    const { container } = render(<PropertyMap properties={many} />);
    const wrapper = container.querySelector("[data-clustering]");
    expect(wrapper?.getAttribute("data-clustering")).toBe("enabled");
    // MarkerClusterer が少なくとも 1 回生成される
    expect(clustererCalls.constructed).toBeGreaterThanOrEqual(1);
  });

  it("クラスタリング有効時はマウント時 marker 数だけ DOM に存在する", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "dummy-key";
    const { PropertyMap } = await import("@/components/map/PropertyMap");
    const many = [...MOCK_PROPERTIES, ...MOCK_PROPERTIES].map((p, i) => ({
      ...p,
      slug: `${p.slug}-${i}`,
    }));
    render(<PropertyMap properties={many} />);
    expect(screen.getAllByTestId("marker").length).toBe(many.length);
  });
});
