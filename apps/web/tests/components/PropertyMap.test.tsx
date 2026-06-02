import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";

// @vis.gl/react-google-maps を軽量モックして API キーありの分岐に到達できるようにする。
// 実 SDK は jsdom 環境で動かないため、必要な named export を最小限のスタブに置き換える。
vi.mock("@vis.gl/react-google-maps", () => {
  type RC = { readonly children?: React.ReactNode };
  const APIProvider = ({ children }: RC) => <div data-testid="api-provider">{children}</div>;
  const GoogleMapStub = ({ children }: RC) => <div data-testid="google-map">{children}</div>;
  const AdvancedMarker = ({ children, onClick }: RC & { readonly onClick?: () => void }) => (
    <button type="button" data-testid="marker" onClick={onClick}>
      {children}
    </button>
  );
  const InfoWindow = ({ children }: RC) => <div data-testid="info-window">{children}</div>;
  const Pin = () => <span data-testid="pin" />;
  return { APIProvider, Map: GoogleMapStub, AdvancedMarker, InfoWindow, Pin };
});

const ORIGINAL_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

beforeEach(() => {
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = undefined;
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
});
