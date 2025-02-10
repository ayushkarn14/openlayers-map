import React, { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { fromLonLat, transformExtent } from "ol/proj";
import axios from "axios";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";
import { Icon, Style, Stroke } from "ol/style";
import XYZ from "ol/source/XYZ";
import { ReactMic } from 'react-mic';

const MapComponent = () => {
    const mapRef = useRef(null);
    const [map, setMap] = useState(null);
    const [record, setRecord] = useState(false);
    const [vectorSource, setVectorSource] = useState(new VectorSource()); // For markers
    const [routeSource, setRouteSource] = useState(new VectorSource()); // For routes
    const [layers, setLayers] = useState({}); // Store layers for toggling
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [audioChunks, setAudioChunks] = useState([]);

    useEffect(() => {
        const baseLayer = new TileLayer({ source: new OSM(), visible: true });
        const satelliteLayer = new TileLayer({
            source: new XYZ({
                url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            }),
            visible: false,
        });
        const terrainLayer = new TileLayer({
            source: new XYZ({
                url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
            }),
            visible: false,
        });
        const highwaysLayer = new TileLayer({
            source: new XYZ({
                url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
            }),
            visible: false,
        });

        const initialVectorLayer = new VectorLayer({ source: vectorSource });
        const routeLayer = new VectorLayer({
            source: routeSource,
            style: new Style({
                stroke: new Stroke({
                    color: "blue",
                    width: 4,
                }),
            }),
        });

        const initialMap = new Map({
            target: mapRef.current,
            layers: [
                baseLayer,
                satelliteLayer,
                terrainLayer,
                highwaysLayer,
                initialVectorLayer,
                routeLayer,
            ],
            view: new View({
                center: fromLonLat([0, 0]),
                zoom: 2,
            }),
        });

        setMap(initialMap);
        setLayers({
            satellite: satelliteLayer,
            terrain: terrainLayer,
            highways: highwaysLayer,
        });

        return () => initialMap.setTarget(null);
    }, []);

    // Function to toggle layers
    const toggleLayer = (layerName) => {
        if (layers[layerName]) {
            const isVisible = layers[layerName].getVisible();
            layers[layerName].setVisible(!isVisible);
        }
    };

    // Function to get coordinates from a place name
    const getCoordinates = async (placeName) => {
        try {
            const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
                params: { q: placeName, format: "json", limit: 1 },
            });

            if (response.data.length > 0) {
                const { lon, lat } = response.data[0];
                return [parseFloat(lon), parseFloat(lat)];
            } else {
                alert(`Location not found: ${placeName}`);
                return null;
            }
        } catch (error) {
            console.error("Error fetching location:", error);
            return null;
        }
    };

    // Function to zoom dynamically based on bounding box
    const zoomToPlace = async (placeName) => {
        const coordinates = await getCoordinates(placeName);
        if (!coordinates) return;

        const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
            params: { q: placeName, format: "json", limit: 1 },
        });

        if (response.data.length > 0) {
            const { boundingbox } = response.data[0];

            const extent = transformExtent(
                [
                    parseFloat(boundingbox[2]),
                    parseFloat(boundingbox[0]),
                    parseFloat(boundingbox[3]),
                    parseFloat(boundingbox[1]),
                ],
                "EPSG:4326",
                "EPSG:3857"
            );
            vectorSource.clear();
            map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });
            addMarker(coordinates[0], coordinates[1]); // Add marker
        }
    };

    // Function to add a marker
    const addMarker = (longitude, latitude) => {
        const marker = new Feature({
            geometry: new Point(fromLonLat([longitude, latitude])),
        });

        marker.setStyle(
            new Style({
                image: new Icon({
                    anchor: [0.5, 1],
                    src: "https://upload.wikimedia.org/wikipedia/commons/e/ec/RedDot.svg",
                    scale: 1,
                }),
            })
        );

        vectorSource.addFeature(marker);
        vectorSource.clear();
    };

    // Function to add a marker by place name
    const addMarkerByPlaceName = async (placeName) => {
        const coordinates = await getCoordinates(placeName);
        if (coordinates) addMarker(coordinates[0], coordinates[1]);
    };

    // Function to find and display route between two places
    const navigateBetweenPlaces = async (startPlace, endPlace) => {
        const startCoords = await getCoordinates(startPlace);
        const endCoords = await getCoordinates(endPlace);

        if (!startCoords || !endCoords) return;

        addMarker(startCoords[0], startCoords[1]); // Add start marker
        addMarker(endCoords[0], endCoords[1]); // Add end marker

        try {
            const apiKey = "5b3ce3597851110001cf6248c76bf805b9ea400fbff79d7f1082d508"; // Replace with your API key
            const response = await axios.get(`https://api.openrouteservice.org/v2/directions/driving-car`, {
                params: {
                    api_key: apiKey,
                    start: `${startCoords[0]},${startCoords[1]}`,
                    end: `${endCoords[0]},${endCoords[1]}`,
                },
            });

            const routeCoords = response.data.features[0].geometry.coordinates;
            const transformedCoords = routeCoords.map((coord) => fromLonLat([coord[0], coord[1]]));

            const routeFeature = new Feature({
                geometry: new LineString(transformedCoords),
            });

            routeSource.clear();
            routeSource.addFeature(routeFeature);

            map.getView().fit(routeFeature.getGeometry().getExtent(), { padding: [50, 50, 50, 50], duration: 1000 });
        } catch (error) {
            console.error("Error fetching route:", error);
        }
    };
    // const startRecording = async () => {
    //     try {
    //         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    //         const recorder = new MediaRecorder(stream);
    //         setAudioChunks([]); // Reset chunks at the start

    //         recorder.ondataavailable = (event) => {
    //             if (event.data.size > 0) {
    //                 setAudioChunks((prev) => [...prev, event.data]);
    //             }
    //         };

    //         recorder.onstop = () => {
    //             // Create a Blob from the recorded audio chunks
    //             const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
    //             // Generate a URL for the Blob and play the audio
    //             const audioURL = URL.createObjectURL(audioBlob);
    //             const audioElement = new Audio(audioURL);
    //             audioElement.play();
    //             console.log("Playing recorded audio...");
    //         };

    //         recorder.start();
    //         setMediaRecorder(recorder);
    //         console.log("Recording started...");
    //     } catch (error) {
    //         console.error("Error accessing microphone:", error);
    //     }
    // };

    // const stopRecording = () => {
    //     if (mediaRecorder) {
    //         // Audio playback is handled automatically in the onstop event handler.
    //         mediaRecorder.stop();
    //         console.log("Recording stopped...");
    //     }
    // };
    const startRecording = () => {
        setRecord(true);
    }

    const stopRecording = () => {
        setRecord(false);
    }

    const onData = (recordedBlob) => {
        console.log('chunk of real-time data is: ', recordedBlob);
    }

    const onStop = (recordedBlob) => {
        sendAudioToAPI(recordedBlob.blob);
        console.log('recordedBlob is: ', recordedBlob);
    }



    // Send recorded audio to a dummy API
    const sendAudioToAPI = async (audioBlob) => {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recorded_audio.wav");

        try {
            const response = await fetch("https://192.168.29.19:8000/transcribe", {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                console.log("Audio uploaded successfully!");
            } else {
                console.error("Error uploading audio:", response.statusText);
            }
        } catch (error) {
            console.error("Error sending audio:", error);
        }
    };


    return (
        <div>
            <div>
                <input type="text" id="placeInput" placeholder="Enter place name" />
                <button onClick={() => zoomToPlace(document.getElementById("placeInput").value)}>Search & Zoom</button>
                <button onClick={() => addMarkerByPlaceName(document.getElementById("placeInput").value)}>
                    Add Marker
                </button>
            </div>
            <div>
                <input type="text" id="startPlace" placeholder="Start place" />
                <input type="text" id="endPlace" placeholder="End place" />
                <button onClick={() => navigateBetweenPlaces(
                    document.getElementById("startPlace").value,
                    document.getElementById("endPlace").value
                )}>
                    Find Route
                </button>
            </div>
            <div>
                <button onClick={() => toggleLayer("satellite")}>Toggle Satellite</button>
                <button onClick={() => toggleLayer("terrain")}>Toggle Terrain</button>
                <button onClick={() => toggleLayer("highways")}>Toggle Highways</button>
            </div>
            <div>
                <button onClick={startRecording}>Start Recording</button>
                <button onClick={stopRecording}>Stop Recording</button>
            </div>
            <div ref={mapRef} style={{ width: "100%", height: "500px" }} />
        </div>
    );
};

export default MapComponent;
