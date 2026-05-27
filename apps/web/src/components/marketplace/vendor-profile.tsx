import Link from "next/link";

import { centsToUsd, compactList, type PublicVendorProfile } from "@/lib/marketplace-api";

type VendorProfileProps = {
  vendor: PublicVendorProfile;
};

function guestRangeLabel(minimum: number | null, maximum: number | null): string {
  if (minimum && maximum) {
    return `${minimum}-${maximum} guests`;
  }
  if (minimum) {
    return `${minimum}+ guests`;
  }
  if (maximum) {
    return `Up to ${maximum} guests`;
  }
  return "Guest count by quote";
}

export function VendorProfile({ vendor }: VendorProfileProps) {
  return (
    <article style={{ display: "grid", gap: 28 }}>
      <header
        style={{
          background: "#fff4df",
          borderRadius: 20,
          display: "grid",
          gap: 12,
          padding: 28,
        }}
      >
        <p style={{ color: "#8a4b00", margin: 0 }}>
          {compactList(vendor.cuisines.map((cuisine) => cuisine.name)) || "Cuisine coming soon"}
        </p>
        <h1 style={{ margin: 0 }}>{vendor.businessName}</h1>
        {vendor.headline ? (
          <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{vendor.headline}</p>
        ) : null}
        <p style={{ maxWidth: 760 }}>
          {vendor.publicDescription ??
            "This vendor is still filling in its public catering profile."}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link href={`/rfq/start?vendorId=${vendor.id}`}>Request a quote from this vendor</Link>
          <Link href="/marketplace">Back to marketplace</Link>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <div>
          <h2>Service Areas</h2>
          <p>
            {vendor.serviceAreas.length
              ? vendor.serviceAreas.map((area) => `${area.metroArea}, ${area.state}`).join(", ")
              : "Service areas are not listed yet."}
          </p>
        </div>
        <div>
          <h2>Service Styles</h2>
          <p>{compactList(vendor.serviceStyles) || "Service styles are not listed yet."}</p>
        </div>
        <div>
          <h2>Planning Fit</h2>
          <p>
            {centsToUsd(vendor.cateringMinimumCents)
              ? `Minimum ${centsToUsd(vendor.cateringMinimumCents)}`
              : "Pricing by quote"}
            {vendor.minimumLeadTimeDays ? ` | ${vendor.minimumLeadTimeDays}+ days lead time` : ""}
          </p>
        </div>
        <div>
          <h2>Dietary Accommodations</h2>
          <p>{compactList(vendor.dietaryAccommodations) || "Confirm needs in RFQ"}</p>
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Event and Service Fit</h2>
        <p>
          Best for office lunches, private parties, weddings, school events, festivals, neighborhood
          events, and community gatherings where the venue can support the selected service model.
        </p>
        <p>
          Supported service models are controlled by the operator:{" "}
          {compactList(vendor.serviceStyles) || "service model to be confirmed"}.
        </p>
      </section>

      <section>
        <h2>Public Menu Previews</h2>
        {vendor.menus.length === 0 ? (
          <p>
            No public menus are posted yet. Request a quote so the operator can recommend the right
            menu for your event.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {vendor.menus.map((menu) => (
              <section
                key={menu.name}
                style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18 }}
              >
                <h3 style={{ marginTop: 0 }}>{menu.name}</h3>
                {menu.description ? <p>{menu.description}</p> : null}
                <p>{guestRangeLabel(menu.minimumGuestCount, menu.maximumGuestCount)}</p>
                {menu.packages.length ? (
                  <>
                    <h4>Sample Packages</h4>
                    <ul>
                      {menu.packages.map((menuPackage) => (
                        <li key={menuPackage.name}>
                          {menuPackage.name}
                          {menuPackage.priceCents
                            ? ` (${centsToUsd(menuPackage.priceCents)} ${menuPackage.pricingModel.replace("_", " ")})`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {menu.items.length ? (
                  <>
                    <h4>Sample Items</h4>
                    <ul>
                      {menu.items.slice(0, 8).map((item) => (
                        <li key={item.name}>
                          {item.name}
                          {item.priceCents ? ` (${centsToUsd(item.priceCents)})` : ""}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Operational Notes</h2>
        <p>
          Final quotes depend on menu selection, guest count, travel, staffing, venue setup, and
          service timing. This profile is a discovery preview, not an instant booking guarantee.
        </p>
        <p>
          Before requesting a quote, be ready to share parking location, power/generator rules,
          venue restrictions, truck access, service window, weather plan, and deposit expectations.
          Operators use those details to decide whether the event is possible and profitable.
        </p>
      </section>
    </article>
  );
}
