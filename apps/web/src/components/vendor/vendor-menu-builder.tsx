"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { PlanField, PlanFormPanel } from "@/components/plan/plan-form-panel";
import { vendorWorkspaceGateMessage } from "@/components/vendor/vendor-workspace-auth";
import { useVendorAuthSession } from "@/lib/auth-session";
import {
  centsToUsd,
  DIETARY_TAG_SUGGESTIONS,
  dollarsToCents,
  formatTagList,
  groupItemsByCategory,
  guestRangeLabel,
  menuApiErrorMessage,
  menuApiRequest,
  MENU_TEMPLATE,
  menuStatusLabel,
  parseTagList,
  pricingModelLabel,
  type CreateMenuItemPayload,
  type CreateMenuPackagePayload,
  type MenuDetail,
  type UpdateMenuItemPayload,
  type UpdateMenuPackagePayload,
  type UpdateMenuPayload,
  type VendorMenuItemRow,
  type VendorMenuPackageRow,
  type VendorMenuPricingModel,
  type VendorMenuStatus,
} from "@/lib/vendor-menu-api";

type EditorTab = "items" | "packages" | "settings";

const panelStyle = {
  background: "rgba(37, 41, 58, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: 20,
  padding: 18,
} as const;

const inputStyle = {
  background: "rgba(60, 67, 91, 0.65)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 12,
  color: "#f8fafc",
  minHeight: 44,
  padding: "10px 12px",
  width: "100%",
} as const;

function statusTone(status: VendorMenuStatus): { background: string; color: string } {
  if (status === "published") {
    return { background: "rgba(156, 245, 121, 0.18)", color: "#9cf579" };
  }
  if (status === "archived") {
    return { background: "rgba(255, 143, 156, 0.16)", color: "#ff8f9c" };
  }
  return { background: "rgba(255, 230, 109, 0.14)", color: "#ffe66d" };
}

function ToggleSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        alignItems: "center",
        color: "#c5cbe0",
        cursor: "pointer",
        display: "flex",
        fontWeight: 700,
        gap: 10,
        justifyContent: "space-between",
      }}
    >
      <span>{label}</span>
      <button
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        style={{
          background: checked ? "linear-gradient(145deg, #c785ff, #d9a8ff)" : "rgba(60, 67, 91, 0.9)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 999,
          color: checked ? "#171b2a" : "#c5cbe0",
          minHeight: 34,
          minWidth: 64,
          padding: "6px 10px",
        }}
        type="button"
      >
        {checked ? "On" : "Off"}
      </button>
    </label>
  );
}

function MenuPreviewPanel({ menuDetail }: { menuDetail: MenuDetail | null }) {
  if (!menuDetail) {
    return (
      <section style={{ ...panelStyle, position: "sticky", top: 24 }}>
        <p style={{ color: "#8f96ac", margin: 0 }}>Select or create a menu to see the guest-facing preview.</p>
      </section>
    );
  }

  const { menu, items, packages } = menuDetail;
  const visibleItems = items.filter((item) => item.isAvailable && item.status === "active");
  const visiblePackages = packages.filter(
    (menuPackage) => menuPackage.isAvailable && menuPackage.status === "active",
  );
  const groupedItems = groupItemsByCategory(visibleItems);

  return (
    <section style={{ ...panelStyle, display: "grid", gap: 14, position: "sticky", top: 24 }}>
      <div>
        <p style={{ color: "#c785ff", fontSize: 13, fontWeight: 800, margin: "0 0 6px" }}>Live preview</p>
        <h2 style={{ margin: "0 0 4px" }}>{menu.name}</h2>
        <p style={{ color: "#8f96ac", fontSize: 14, margin: 0 }}>
          {menu.isPublic && menu.status === "published"
            ? "Shown on your public vendor profile"
            : "Internal preview — publish and mark public to show on marketplace"}
        </p>
      </div>

      <div
        style={{
          background: "linear-gradient(145deg, rgba(199, 133, 255, 0.16), rgba(37, 41, 58, 0.9))",
          border: "1px solid rgba(199, 133, 255, 0.28)",
          borderRadius: 16,
          display: "grid",
          gap: 10,
          padding: 16,
        }}
      >
        {menu.description ? <p style={{ margin: 0 }}>{menu.description}</p> : null}
        <p style={{ color: "#c5cbe0", margin: 0 }}>
          {guestRangeLabel(menu.minimumGuestCount, menu.maximumGuestCount)}
        </p>
        {menu.dietaryTags.length ? (
          <p style={{ color: "#9cf579", fontSize: 14, margin: 0 }}>
            {menu.dietaryTags.join(" · ")}
          </p>
        ) : null}
      </div>

      {visiblePackages.length ? (
        <div>
          <h3 style={{ margin: "0 0 8px" }}>Sample packages</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {visiblePackages.map((menuPackage) => (
              <li key={menuPackage.id} style={{ marginBottom: 8 }}>
                <strong>{menuPackage.name}</strong>
                {menuPackage.priceCents ? (
                  <span style={{ color: "#87ddf7" }}>
                    {" "}
                    — {centsToUsd(menuPackage.priceCents)} {pricingModelLabel(menuPackage.pricingModel)}
                  </span>
                ) : null}
                {menuPackage.minimumGuestCount ? (
                  <span style={{ color: "#8f96ac", display: "block", fontSize: 13 }}>
                    {guestRangeLabel(menuPackage.minimumGuestCount, menuPackage.maximumGuestCount)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {groupedItems.length ? (
        <div>
          <h3 style={{ margin: "0 0 8px" }}>Menu items</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {groupedItems.map((group) => (
              <div key={group.category}>
                <p
                  style={{
                    color: "#ffe66d",
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    margin: "0 0 6px",
                    textTransform: "uppercase",
                  }}
                >
                  {group.category}
                </p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {group.items.map((item) => (
                    <li key={item.id} style={{ marginBottom: 6 }}>
                      {item.name}
                      {item.priceCents ? (
                        <span style={{ color: "#87ddf7" }}> ({centsToUsd(item.priceCents)})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p style={{ color: "#8f96ac", margin: 0 }}>Add at least one item or package for quoting and previews.</p>
      )}
    </section>
  );
}

export function VendorMenuBuilder() {
  const session = useVendorAuthSession();
  const [menus, setMenus] = useState<MenuDetail[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("items");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [settingsDraft, setSettingsDraft] = useState<UpdateMenuPayload>({});
  const [newItem, setNewItem] = useState<CreateMenuItemPayload>({
    category: "Mains",
    name: "",
    priceCents: undefined,
  });
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newPackage, setNewPackage] = useState<CreateMenuPackagePayload>({
    name: "",
    pricingModel: "per_person",
  });
  const [newPackagePrice, setNewPackagePrice] = useState("");

  const selectedMenu = useMemo(
    () => menus.find((detail) => detail.menu.id === selectedMenuId) ?? null,
    [menus, selectedMenuId],
  );

  const vendorPath = useCallback(
    (suffix: string) =>
      `/api/v1/vendors/${encodeURIComponent(session.activeVendorId.trim())}${suffix}`,
    [session.activeVendorId],
  );

  const loadMenus = useCallback(async () => {
    setError(null);
    setSuccess(null);

    const gateMessage = vendorWorkspaceGateMessage(session);
    if (gateMessage) {
      setError(gateMessage);
      setMenus([]);
      setSelectedMenuId(null);
      return;
    }

    setIsLoading(true);

    try {
      const result = await menuApiRequest<MenuDetail[]>({
        apiBaseUrl: session.apiBaseUrl,
        path: vendorPath("/menus"),
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(menuApiErrorMessage(result.body, `Failed to load menus (${result.status}).`));
      }

      setMenus(result.data);
      setSelectedMenuId((current) => {
        if (current && result.data?.some((detail) => detail.menu.id === current)) {
          return current;
        }
        return result.data?.[0]?.menu.id ?? null;
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load menus.");
    } finally {
      setIsLoading(false);
    }
  }, [session, vendorPath]);

  useEffect(() => {
    void loadMenus();
  }, [loadMenus, session.activeVendorId]);

  useEffect(() => {
    if (!selectedMenu) {
      setSettingsDraft({});
      return;
    }

    const { menu } = selectedMenu;
    setSettingsDraft({
      description: menu.description ?? undefined,
      dietaryTags: menu.dietaryTags,
      isPublic: menu.isPublic,
      maximumGuestCount: menu.maximumGuestCount ?? undefined,
      minimumGuestCount: menu.minimumGuestCount ?? undefined,
      name: menu.name,
      prepLeadTimeHours: menu.prepLeadTimeHours ?? undefined,
      serviceStyles: menu.serviceStyles,
      status: menu.status,
    });
    setActiveTab("items");
  }, [selectedMenu?.menu.id]);

  function replaceMenuDetail(nextDetail: MenuDetail) {
    setMenus((current) =>
      current.map((detail) => (detail.menu.id === nextDetail.menu.id ? nextDetail : detail)),
    );
  }

  async function refreshMenu(menuId: string) {
    const result = await menuApiRequest<MenuDetail>({
      apiBaseUrl: session.apiBaseUrl,
      path: vendorPath(`/menus/${encodeURIComponent(menuId)}`),
      token: session.accessToken,
    });

    if (!result.ok || !result.data) {
      throw new Error(menuApiErrorMessage(result.body, `Failed to refresh menu (${result.status}).`));
    }

    replaceMenuDetail(result.data);
    return result.data;
  }

  async function createMenuFromTemplate() {
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const result = await menuApiRequest<MenuDetail>({
        apiBaseUrl: session.apiBaseUrl,
        body: MENU_TEMPLATE,
        method: "POST",
        path: vendorPath("/menus"),
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(menuApiErrorMessage(result.body, `Failed to create menu (${result.status}).`));
      }

      setMenus((current) => [...current, result.data!]);
      setSelectedMenuId(result.data.menu.id);
      setSuccess("Starter menu created. Customize items, packages, and visibility.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to create menu.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSettings() {
    if (!selectedMenu) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const result = await menuApiRequest<MenuDetail>({
        apiBaseUrl: session.apiBaseUrl,
        body: settingsDraft,
        method: "PATCH",
        path: vendorPath(`/menus/${encodeURIComponent(selectedMenu.menu.id)}`),
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(menuApiErrorMessage(result.body, `Failed to save menu (${result.status}).`));
      }

      replaceMenuDetail(result.data);
      setSuccess("Menu settings saved.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to save menu settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSelectedMenu() {
    if (!selectedMenu) {
      return;
    }

    if (!window.confirm(`Archive "${selectedMenu.menu.name}"? This removes it from active use.`)) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const result = await menuApiRequest<MenuDetail>({
        apiBaseUrl: session.apiBaseUrl,
        method: "DELETE",
        path: vendorPath(`/menus/${encodeURIComponent(selectedMenu.menu.id)}`),
        token: session.accessToken,
      });

      if (!result.ok) {
        throw new Error(menuApiErrorMessage(result.body, `Failed to archive menu (${result.status}).`));
      }

      setMenus((current) => current.filter((detail) => detail.menu.id !== selectedMenu.menu.id));
      setSelectedMenuId(null);
      setSuccess("Menu archived.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to archive menu.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addItem() {
    if (!selectedMenu || !newItem.name.trim()) {
      setError("Item name is required.");
      return;
    }

    const priceCents = dollarsToCents(newItemPrice);
    const payload: CreateMenuItemPayload = {
      ...newItem,
      name: newItem.name.trim(),
      priceCents,
      sortOrder: selectedMenu.items.length,
    };

    setIsSaving(true);
    setError(null);

    try {
      const result = await menuApiRequest<VendorMenuItemRow>({
        apiBaseUrl: session.apiBaseUrl,
        body: payload,
        method: "POST",
        path: vendorPath(`/menus/${encodeURIComponent(selectedMenu.menu.id)}/items`),
        token: session.accessToken,
      });

      if (!result.ok) {
        throw new Error(menuApiErrorMessage(result.body, `Failed to add item (${result.status}).`));
      }

      await refreshMenu(selectedMenu.menu.id);
      setNewItem({ category: newItem.category, name: "", priceCents: undefined });
      setNewItemPrice("");
      setSuccess("Item added.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to add item.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateItem(itemId: string, patch: UpdateMenuItemPayload) {
    if (!selectedMenu) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await menuApiRequest<VendorMenuItemRow>({
        apiBaseUrl: session.apiBaseUrl,
        body: patch,
        method: "PATCH",
        path: vendorPath(
          `/menus/${encodeURIComponent(selectedMenu.menu.id)}/items/${encodeURIComponent(itemId)}`,
        ),
        token: session.accessToken,
      });

      if (!result.ok) {
        throw new Error(menuApiErrorMessage(result.body, `Failed to update item (${result.status}).`));
      }

      await refreshMenu(selectedMenu.menu.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to update item.");
    } finally {
      setIsSaving(false);
    }
  }

  async function moveItem(item: VendorMenuItemRow, direction: -1 | 1) {
    if (!selectedMenu) {
      return;
    }

    const sorted = [...selectedMenu.items].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sorted.findIndex((entry) => entry.id === item.id);
    const swapIndex = index + direction;

    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) {
      return;
    }

    const other = sorted[swapIndex]!;
    await Promise.all([
      updateItem(item.id, { sortOrder: other.sortOrder }),
      updateItem(other.id, { sortOrder: item.sortOrder }),
    ]);
  }

  async function addPackage() {
    if (!selectedMenu || !newPackage.name.trim()) {
      setError("Package name is required.");
      return;
    }

    const priceCents = dollarsToCents(newPackagePrice);
    const payload: CreateMenuPackagePayload = {
      ...newPackage,
      name: newPackage.name.trim(),
      priceCents,
      sortOrder: selectedMenu.packages.length,
    };

    setIsSaving(true);
    setError(null);

    try {
      const result = await menuApiRequest<VendorMenuPackageRow>({
        apiBaseUrl: session.apiBaseUrl,
        body: payload,
        method: "POST",
        path: vendorPath(`/menus/${encodeURIComponent(selectedMenu.menu.id)}/packages`),
        token: session.accessToken,
      });

      if (!result.ok) {
        throw new Error(menuApiErrorMessage(result.body, `Failed to add package (${result.status}).`));
      }

      await refreshMenu(selectedMenu.menu.id);
      setNewPackage({ name: "", pricingModel: "per_person" });
      setNewPackagePrice("");
      setSuccess("Package added.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to add package.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updatePackage(packageId: string, patch: UpdateMenuPackagePayload) {
    if (!selectedMenu) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await menuApiRequest<VendorMenuPackageRow>({
        apiBaseUrl: session.apiBaseUrl,
        body: patch,
        method: "PATCH",
        path: vendorPath(
          `/menus/${encodeURIComponent(selectedMenu.menu.id)}/packages/${encodeURIComponent(packageId)}`,
        ),
        token: session.accessToken,
      });

      if (!result.ok) {
        throw new Error(menuApiErrorMessage(result.body, `Failed to update package (${result.status}).`));
      }

      await refreshMenu(selectedMenu.menu.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to update package.");
    } finally {
      setIsSaving(false);
    }
  }

  const groupedItems = selectedMenu ? groupItemsByCategory(selectedMenu.items) : [];

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 1320, padding: "0 20px" }}>
      <p>
        <Link href={ROUTES.vendor.dashboard}>← Vendor Dashboard</Link>
      </p>

      <section
        style={{
          background: "linear-gradient(145deg, rgba(199, 133, 255, 0.22), rgba(37, 41, 58, 0.95))",
          border: "1px solid rgba(199, 133, 255, 0.32)",
          borderRadius: 24,
          display: "grid",
          gap: 12,
          marginBottom: 24,
          padding: 28,
        }}
      >
        <p style={{ color: "#d9a8ff", fontWeight: 800, margin: 0 }}>Menu builder</p>
        <h1 style={{ margin: 0 }}>Build reusable catering menus</h1>
        <p style={{ color: "#c5cbe0", fontSize: 18, lineHeight: 1.5, margin: 0, maxWidth: 760 }}>
          Organize items by category, bundle packages with per-person pricing, toggle availability
          instantly, and preview how guests see your menu on the marketplace.
        </p>
      </section>

      <section style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "20px 0" }}>
        <button disabled={isLoading || isSaving} onClick={() => void loadMenus()} type="button">
          {isLoading ? "Refreshing…" : "Refresh menus"}
        </button>
        <button disabled={isSaving} onClick={() => void createMenuFromTemplate()} type="button">
          Start from template
        </button>
        <Link href="/marketplace" style={{ alignSelf: "center" }}>
          Preview marketplace
        </Link>
        <Link href={ROUTES.vendor.rfqs} style={{ alignSelf: "center" }}>
          RFQ inbox
        </Link>
      </section>

      {error ? (
        <p style={{ background: "rgba(255, 143, 156, 0.12)", borderRadius: 12, color: "#ff8f9c", padding: 12 }}>
          {error}
        </p>
      ) : null}
      {success ? (
        <p style={{ background: "rgba(156, 245, 121, 0.12)", borderRadius: 12, color: "#9cf579", padding: 12 }}>
          {success}
        </p>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: 20,
          gridTemplateColumns: "minmax(220px, 260px) minmax(0, 1fr) minmax(260px, 320px)",
          marginTop: 8,
        }}
      >
        <aside style={{ display: "grid", gap: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Your menus</h2>
          {menus.length === 0 ? (
            <div style={panelStyle}>
              <p style={{ color: "#8f96ac", marginTop: 0 }}>
                No menus yet. Start from the template to get categories, items, and a sample package in
                one click.
              </p>
            </div>
          ) : (
            menus.map((detail) => {
              const tone = statusTone(detail.menu.status);
              const isActive = detail.menu.id === selectedMenuId;

              return (
                <button
                  key={detail.menu.id}
                  onClick={() => setSelectedMenuId(detail.menu.id)}
                  style={{
                    ...panelStyle,
                    cursor: "pointer",
                    display: "grid",
                    gap: 8,
                    outline: isActive ? "2px solid #c785ff" : "none",
                    textAlign: "left",
                    width: "100%",
                  }}
                  type="button"
                >
                  <strong style={{ color: "#f8fafc" }}>{detail.menu.name}</strong>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <span
                      style={{
                        ...tone,
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 800,
                        padding: "4px 10px",
                      }}
                    >
                      {menuStatusLabel(detail.menu.status)}
                    </span>
                    {detail.menu.isPublic ? (
                      <span
                        style={{
                          background: "rgba(135, 221, 247, 0.16)",
                          borderRadius: 999,
                          color: "#87ddf7",
                          fontSize: 12,
                          fontWeight: 800,
                          padding: "4px 10px",
                        }}
                      >
                        Public
                      </span>
                    ) : (
                      <span
                        style={{
                          background: "rgba(143, 150, 172, 0.2)",
                          borderRadius: 999,
                          color: "#8f96ac",
                          fontSize: 12,
                          fontWeight: 800,
                          padding: "4px 10px",
                        }}
                      >
                        Private
                      </span>
                    )}
                  </span>
                  <span style={{ color: "#8f96ac", fontSize: 13 }}>
                    {detail.items.length} items · {detail.packages.length} packages
                  </span>
                </button>
              );
            })
          )}
        </aside>

        <section style={{ display: "grid", gap: 16, minWidth: 0 }}>
          {!selectedMenu ? (
            <div style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Select a menu to edit</h2>
              <p style={{ color: "#8f96ac" }}>
                Create a starter menu or pick one from the sidebar. Drag-style reordering uses the
                move buttons on each item card.
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(["items", "packages", "settings"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      background:
                        activeTab === tab
                          ? "linear-gradient(145deg, #c785ff, #d9a8ff)"
                          : "rgba(60, 67, 91, 0.9)",
                      color: activeTab === tab ? "#171b2a" : "#f8fafc",
                    }}
                    type="button"
                  >
                    {tab === "items" ? "Items" : tab === "packages" ? "Packages" : "Settings"}
                  </button>
                ))}
              </div>

              {activeTab === "items" ? (
                <div style={{ display: "grid", gap: 16 }}>
                  {groupedItems.length === 0 ? (
                    <div style={panelStyle}>
                      <p style={{ color: "#8f96ac", marginTop: 0 }}>
                        Add your first item below. Group entrees, sides, and beverages with categories
                        so guests scan faster.
                      </p>
                    </div>
                  ) : (
                    groupedItems.map((group) => (
                      <section key={group.category} style={panelStyle}>
                        <h3
                          style={{
                            color: "#ffe66d",
                            fontSize: 13,
                            letterSpacing: "0.06em",
                            margin: "0 0 12px",
                            textTransform: "uppercase",
                          }}
                        >
                          {group.category}
                        </h3>
                        <div style={{ display: "grid", gap: 10 }}>
                          {group.items.map((item) => (
                            <article
                              key={item.id}
                              style={{
                                background: "rgba(48, 54, 75, 0.65)",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                borderRadius: 14,
                                display: "grid",
                                gap: 10,
                                padding: 12,
                              }}
                            >
                              <div
                                style={{
                                  alignItems: "start",
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 10,
                                  justifyContent: "space-between",
                                }}
                              >
                                <div>
                                  <strong>{item.name}</strong>
                                  {item.priceCents ? (
                                    <p style={{ color: "#87ddf7", margin: "4px 0 0" }}>
                                      {centsToUsd(item.priceCents)}
                                    </p>
                                  ) : (
                                    <p style={{ color: "#8f96ac", margin: "4px 0 0" }}>Price by quote</p>
                                  )}
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    disabled={isSaving}
                                    onClick={() => void moveItem(item, -1)}
                                    style={{ minHeight: 36, minWidth: 36, padding: 0 }}
                                    title="Move up"
                                    type="button"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    disabled={isSaving}
                                    onClick={() => void moveItem(item, 1)}
                                    style={{ minHeight: 36, minWidth: 36, padding: 0 }}
                                    title="Move down"
                                    type="button"
                                  >
                                    ↓
                                  </button>
                                </div>
                              </div>
                              <ToggleSwitch
                                checked={item.isAvailable}
                                label="Available for quotes"
                                onChange={(checked) => void updateItem(item.id, { isAvailable: checked })}
                              />
                              {item.dietaryTags.length ? (
                                <p style={{ color: "#9cf579", fontSize: 13, margin: 0 }}>
                                  {item.dietaryTags.join(" · ")}
                                </p>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </section>
                    ))
                  )}

                  <PlanFormPanel title="Add menu item">
                    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                      <PlanField label="Name">
                        <input
                          onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))}
                          style={inputStyle}
                          value={newItem.name}
                        />
                      </PlanField>
                      <PlanField label="Category">
                        <input
                          onChange={(event) =>
                            setNewItem((current) => ({ ...current, category: event.target.value }))
                          }
                          placeholder="Mains, Sides, Drinks…"
                          style={inputStyle}
                          value={newItem.category ?? ""}
                        />
                      </PlanField>
                      <PlanField label="Price (USD)">
                        <input
                          onChange={(event) => setNewItemPrice(event.target.value)}
                          placeholder="18.00"
                          style={inputStyle}
                          value={newItemPrice}
                        />
                      </PlanField>
                    </div>
                    <PlanField label="Dietary tags (comma-separated)">
                      <input
                        onChange={(event) =>
                          setNewItem((current) => ({
                            ...current,
                            dietaryTags: parseTagList(event.target.value),
                          }))
                        }
                        placeholder="vegetarian-available, gluten-free-available"
                        style={inputStyle}
                        value={formatTagList(newItem.dietaryTags ?? [])}
                      />
                    </PlanField>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {DIETARY_TAG_SUGGESTIONS.map((tag) => (
                        <button
                          key={tag}
                          onClick={() =>
                            setNewItem((current) => ({
                              ...current,
                              dietaryTags: [...new Set([...(current.dietaryTags ?? []), tag])],
                            }))
                          }
                          style={{
                            background: "rgba(199, 133, 255, 0.16)",
                            color: "#d9a8ff",
                            fontSize: 12,
                            minHeight: 32,
                            padding: "6px 10px",
                          }}
                          type="button"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                    <button disabled={isSaving} onClick={() => void addItem()} type="button">
                      Add item
                    </button>
                  </PlanFormPanel>
                </div>
              ) : null}

              {activeTab === "packages" ? (
                <div style={{ display: "grid", gap: 16 }}>
                  {selectedMenu.packages.length === 0 ? (
                    <div style={panelStyle}>
                      <p style={{ color: "#8f96ac", marginTop: 0 }}>
                        Packages bundle items for catering quotes — buffet per-person, fixed event
                        fees, or market pricing.
                      </p>
                    </div>
                  ) : (
                    selectedMenu.packages.map((menuPackage) => (
                      <article key={menuPackage.id} style={panelStyle}>
                        <div
                          style={{
                            alignItems: "start",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 10,
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <h3 style={{ margin: "0 0 4px" }}>{menuPackage.name}</h3>
                            {menuPackage.priceCents ? (
                              <p style={{ color: "#87ddf7", margin: 0 }}>
                                {centsToUsd(menuPackage.priceCents)}{" "}
                                {pricingModelLabel(menuPackage.pricingModel)}
                              </p>
                            ) : (
                              <p style={{ color: "#8f96ac", margin: 0 }}>Price by quote</p>
                            )}
                            <p style={{ color: "#8f96ac", fontSize: 13, margin: "6px 0 0" }}>
                              {guestRangeLabel(
                                menuPackage.minimumGuestCount,
                                menuPackage.maximumGuestCount,
                              )}
                            </p>
                          </div>
                        </div>
                        <ToggleSwitch
                          checked={menuPackage.isAvailable}
                          label="Available for quotes"
                          onChange={(checked) =>
                            void updatePackage(menuPackage.id, { isAvailable: checked })
                          }
                        />
                      </article>
                    ))
                  )}

                  <PlanFormPanel title="Add package">
                    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                      <PlanField label="Name">
                        <input
                          onChange={(event) =>
                            setNewPackage((current) => ({ ...current, name: event.target.value }))
                          }
                          style={inputStyle}
                          value={newPackage.name}
                        />
                      </PlanField>
                      <PlanField label="Pricing model">
                        <select
                          onChange={(event) =>
                            setNewPackage((current) => ({
                              ...current,
                              pricingModel: event.target.value as VendorMenuPricingModel,
                            }))
                          }
                          style={inputStyle}
                          value={newPackage.pricingModel ?? "per_person"}
                        >
                          <option value="per_person">Per person</option>
                          <option value="fixed">Fixed event</option>
                          <option value="market">Market / quote</option>
                        </select>
                      </PlanField>
                      <PlanField label="Price (USD)">
                        <input
                          onChange={(event) => setNewPackagePrice(event.target.value)}
                          placeholder="28.00"
                          style={inputStyle}
                          value={newPackagePrice}
                        />
                      </PlanField>
                      <PlanField label="Minimum guests">
                        <input
                          onChange={(event) =>
                            setNewPackage((current) => ({
                              ...current,
                              minimumGuestCount: event.target.value
                                ? Number.parseInt(event.target.value, 10)
                                : undefined,
                            }))
                          }
                          style={inputStyle}
                          type="number"
                          value={newPackage.minimumGuestCount ?? ""}
                        />
                      </PlanField>
                    </div>
                    <button disabled={isSaving} onClick={() => void addPackage()} type="button">
                      Add package
                    </button>
                  </PlanFormPanel>
                </div>
              ) : null}

              {activeTab === "settings" ? (
                <PlanFormPanel title="Menu settings">
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                    <PlanField label="Menu name">
                      <input
                        onChange={(event) =>
                          setSettingsDraft((current) => ({ ...current, name: event.target.value }))
                        }
                        style={inputStyle}
                        value={settingsDraft.name ?? ""}
                      />
                    </PlanField>
                    <PlanField label="Status">
                      <select
                        onChange={(event) =>
                          setSettingsDraft((current) => ({
                            ...current,
                            status: event.target.value as VendorMenuStatus,
                          }))
                        }
                        style={inputStyle}
                        value={settingsDraft.status ?? "draft"}
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                    </PlanField>
                    <PlanField label="Minimum guests">
                      <input
                        onChange={(event) =>
                          setSettingsDraft((current) => ({
                            ...current,
                            minimumGuestCount: event.target.value
                              ? Number.parseInt(event.target.value, 10)
                              : undefined,
                          }))
                        }
                        style={inputStyle}
                        type="number"
                        value={settingsDraft.minimumGuestCount ?? ""}
                      />
                    </PlanField>
                    <PlanField label="Maximum guests">
                      <input
                        onChange={(event) =>
                          setSettingsDraft((current) => ({
                            ...current,
                            maximumGuestCount: event.target.value
                              ? Number.parseInt(event.target.value, 10)
                              : undefined,
                          }))
                        }
                        style={inputStyle}
                        type="number"
                        value={settingsDraft.maximumGuestCount ?? ""}
                      />
                    </PlanField>
                  </div>
                  <PlanField label="Description">
                    <textarea
                      onChange={(event) =>
                        setSettingsDraft((current) => ({ ...current, description: event.target.value }))
                      }
                      rows={3}
                      style={{ ...inputStyle, minHeight: 96 }}
                      value={settingsDraft.description ?? ""}
                    />
                  </PlanField>
                  <PlanField label="Menu dietary tags">
                    <input
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          dietaryTags: parseTagList(event.target.value),
                        }))
                      }
                      style={inputStyle}
                      value={formatTagList(settingsDraft.dietaryTags ?? [])}
                    />
                  </PlanField>
                  <PlanField label="Service styles (comma-separated)">
                    <input
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          serviceStyles: parseTagList(event.target.value),
                        }))
                      }
                      placeholder="buffet, truck onsite"
                      style={inputStyle}
                      value={formatTagList(settingsDraft.serviceStyles ?? [])}
                    />
                  </PlanField>
                  <ToggleSwitch
                    checked={Boolean(settingsDraft.isPublic)}
                    label="Show on public vendor profile when published"
                    onChange={(checked) =>
                      setSettingsDraft((current) => ({ ...current, isPublic: checked }))
                    }
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <button disabled={isSaving} onClick={() => void saveSettings()} type="button">
                      Save settings
                    </button>
                    <button
                      disabled={isSaving}
                      onClick={() => void deleteSelectedMenu()}
                      style={{ background: "rgba(255, 143, 156, 0.2)", color: "#ff8f9c" }}
                      type="button"
                    >
                      Archive menu
                    </button>
                  </div>
                </PlanFormPanel>
              ) : null}
            </>
          )}
        </section>

        <MenuPreviewPanel menuDetail={selectedMenu} />
      </div>
    </main>
  );
}
