import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { useQuery } from '@tanstack/react-query';

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

export function DonationMap({ pickupLocation, driverId }: Props) {
  const { data: driverLoc } = useQuery<{latitude: number, longitude: number, timestamp: string}>({
    queryKey: ['driver_location', driverId],
    enabled: !!driverId,
  });

  // Center on pickup location initially
  const center: [number, number] = [pickupLocation.latitude, pickupLocation.longitude];

  return (
    <div className="h-96 w-full rounded-lg overflow-hidden border border-gray-300 shadow-sm">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Marker position={[pickupLocation.latitude, pickupLocation.longitude]}>
          <Popup>
            <b>Pickup Location</b><br/>{pickupLocation.address}
          </Popup>
        </Marker>
        
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
