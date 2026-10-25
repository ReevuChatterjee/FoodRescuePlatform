import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiClient } from '../../api/client';
import { getClientTomTomKey } from '../../hooks/useTrafficRoute';

// Fix leaflet default icon issue in React
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Props {
  pickupLocation: { latitude: number; longitude: number; address: string };
  ngoId: string | null;
  driverId: string | null;
}

interface NGOProfile {
  ngo_id: string;
  organisation_name: string;
  location: { latitude: number | null; longitude: number | null };
}

export function DonationMap({ pickupLocation, ngoId, driverId }: Props) {
  const tomtomKey = useMemo(() => getClientTomTomKey(), []);
  const { data: driverLoc } = useQuery<{latitude: number, longitude: number, timestamp: string}>({
    queryKey: ['driver_location', driverId],
    enabled: !!driverId,
  });

  // Fetch NGO profile to get its coordinates for the map marker
  const { data: ngoRaw } = useQuery<NGOProfile>({
    queryKey: ['ngo', ngoId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/ngos/${ngoId}`);
      return response.data.data;
    },
    enabled: !!ngoId,
  });

  // Center on pickup location initially
  const center: [number, number] = [pickupLocation.latitude, pickupLocation.longitude];

  const ngoLocation =
    ngoRaw?.location?.latitude != null && ngoRaw?.location?.longitude != null
      ? ([ngoRaw.location.latitude, ngoRaw.location.longitude] as [number, number])
      : null;

  return (
    <div className="h-96 w-full rounded-lg overflow-hidden border border-gray-300 shadow-sm">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="h-full w-full">
        {tomtomKey ? (
          <TileLayer
            url={`https://{s}.api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${tomtomKey}`}
            subdomains={['a', 'b', 'c', 'd']}
            attribution='&copy; <a href="https://www.tomtom.com" target="_blank" rel="noreferrer">TomTom</a>'
            maxZoom={22}
          />
        ) : (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
        )}
        <Marker position={[pickupLocation.latitude, pickupLocation.longitude]}>
          <Popup>
            <b>Pickup Location</b><br/>{pickupLocation.address}
          </Popup>
        </Marker>

        {ngoLocation && (
          <Marker position={ngoLocation}>
            <Popup>
              <b>NGO Delivery Point</b>
              {ngoRaw?.organisation_name && <><br/>{ngoRaw.organisation_name}</>}
            </Popup>
          </Marker>
        )}

        {driverLoc && (
          <Marker position={[driverLoc.latitude, driverLoc.longitude]}>
            <Popup>
              <b>Driver Location</b>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
