import { AddressLocationClient } from "@/components/address-location-client";
import { getRestaurantSettingsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AddressPage() {
  const restaurantSettings = await getRestaurantSettingsFromDb();

  return (
    <main className="bg-white sm:px-6 lg:px-8">
      <AddressLocationClient restaurantSettings={restaurantSettings} />
    </main>
  );
}
