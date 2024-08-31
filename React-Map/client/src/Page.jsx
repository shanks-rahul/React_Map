import { APIProvider, Map, useMapsLibrary, useMap, AdvancedMarker } from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";
import axios from "axios";
import { useJsApiLoader } from "@react-google-maps/api";
import PlacesAutocomplete from "./AutoComplete";
import { io } from 'socket.io-client';

const socket = io('http://localhost:5173');
const heritagePlaces = [
    { name: "Taj Mahal", location: { lat: 27.1751, lng: 78.0421 } },
    { name: "Qutub Minar", location: { lat: 28.5244, lng: 77.1855 } },
    { name: "Red Fort", location: { lat: 28.6562, lng: 77.2410 } },
    { name: "Humayun's Tomb", location: { lat: 28.5933, lng: 77.2507 } },
    { name: "Gateway of India", location: { lat: 18.9220, lng: 72.8347 } },
    { name: "Hampi", location: { lat: 15.3350, lng: 76.4600 } },
    { name: "Ajanta Caves", location: { lat: 20.5523, lng: 75.7033 } },
    { name: "Sun Temple, Konark", location: { lat: 19.8876, lng: 86.0945 } },
    { name: "Mysore Palace", location: { lat: 12.3052, lng: 76.6552 } },
    { name: "Ellora Caves", location: { lat: 20.0269, lng: 75.1790 } },
];

function MapPage() {
    const [position, setPosition] = useState({ latitude: null, longitude: null });
    const [address, setAddress] = useState('');
    const [error, setError] = useState(null);

    const getLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const newPosition = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    };
                    setPosition(newPosition);
                    socket.emit('updateLocation', newPosition);

                    const apiKey = 'AIzaSyCAIiQ8mbIhQRsaBF7zf1HxpE_lLmrL5H0';
                    const res = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${newPosition.latitude},${newPosition.longitude}&key=${apiKey}`);
                    if (res.data.results.length > 0) {
                        setAddress(res.data.results[0].formatted_address);
                    } else {
                        setAddress('Address not found');
                    }
                },
                (error) => {
                    setError('Failed to get location');
                },
                { enableHighAccuracy: true } 
            );
        } else {
            setError('Geolocation is not supported by this browser');
        }
    };

    useEffect(() => {
        getLocation();
    }, []);

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: "AIzaSyCAIiQ8mbIhQRsaBF7zf1HxpE_lLmrL5H0",
        libraries: ["places"],
    });

    if (!isLoaded) return <div>Loading...</div>;
    return <Maps position={position} address={address} />;
}

function Maps({ position, address }) {
    const [selected, setSelected] = useState(null);

    const handleMarkerClick = (place) => {
        setSelected(place.location);
    };

    return (
        <>
            <div className="places-container">
                <PlacesAutocomplete setSelected={setSelected} />
            </div>
            <APIProvider apiKey="AIzaSyCAIiQ8mbIhQRsaBF7zf1HxpE_lLmrL5H0">
                <div style={{ height: '100vh', width: '100vw' }}>
                    <Map defaultCenter={{ lat: position.latitude || 47, lng: position.longitude || 74 }} defaultZoom={5} mapId="ea3a15970827eae1">
                        <Directions dest={selected} position={position} address={address} />
                        {heritagePlaces.map((place, index) => (
                            <AdvancedMarker
                                key={index}
                                position={place.location}
                                label={place.name}
                                onClick={() => handleMarkerClick(place)}
                            />
                        ))}
                    </Map>
                </div>
            </APIProvider>
        </>
    );
}

function Directions({ dest, position, address }) {
    const map = useMap();
    const routesLibrary = useMapsLibrary("routes");
    const [directionsService, setDirectionsService] = useState(null);
    const [directionsRenderer, setDirectionsRenderer] = useState(null);
    const [routes, setRoutes] = useState([]);
    const [routeIndex, setRouteIndex] = useState(0);
    const selectedRoute = routes[routeIndex];
    const leg = selectedRoute?.legs[0];

    useEffect(() => {
        if (routesLibrary && map) {
            setDirectionsService(new routesLibrary.DirectionsService());
            setDirectionsRenderer(new routesLibrary.DirectionsRenderer({ map }));
        }
    }, [routesLibrary, map]);

    useEffect(() => {
        if (directionsRenderer && directionsService && dest && address) {
            directionsService.route({
                origin: address,
                destination: dest,
                travelMode: google.maps.TravelMode.DRIVING,
                provideRouteAlternatives: true
            }).then(response => {
                directionsRenderer.setDirections(response);
                setRoutes(response.routes);
            });
        }
    }, [directionsRenderer, directionsService, dest, address]);

    useEffect(() => {
        if (directionsRenderer) {
            directionsRenderer.setRouteIndex(routeIndex);
        }
    }, [directionsRenderer, routeIndex]);

    useEffect(() => {
        socket.on('locationUpdated', (newLocation) => {
            setPosition(newLocation);
        });

        return () => {
            socket.off('locationUpdated');
        };
    }, []);

    if (!leg) return null;

    return (
        <div className="directions">
            <h2>{selectedRoute.summary}</h2>
            <p>{leg.start_address.split(",")[0]} to {leg.end_address.split(",")[0]}</p>
            <p>Distance: {leg.distance?.text}</p>
            <p>Duration: {leg.duration?.text}</p>
            <h2>Other Routes</h2>
            <ul>
                {routes.map((route, index) => (
                    <li key={route.summary}>
                        <button onClick={() => setRouteIndex(index)}>{route.summary}</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default MapPage;
