const dds_config = require("../dds_config.json")

function calculateDistance(src, dest) {
    // Haversine formula

    const R = 6371e3;
    const lat1Rad = src.lat * Math.PI / 180;
    const lat2Rad = dest.lat * Math.PI / 180;
    const deltaLat = (dest.lat - src.lat) * Math.PI / 180;
    const deltaLon = (dest.lng - src.lng) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1Rad) * Math.cos(lat2Rad) *
        Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

async function calculateETA(fromStation, toStation) {
    const distanceInMeters = calculateDistance({ lat: fromStation.lat, lng: fromStation.lng }, { lat: toStation.lat, lng: toStation.lng })

    console.log(`Distance (m) between station ${fromStation.id} and ${toStation.id} is ${distanceInMeters}`)

    return distanceInMeters / dds_config.drone_speed_in_meters_per_sec + 2 * dds_config.takeoff_time_in_seconds
}

module.exports.calculateDistance = calculateDistance
module.exports.calculateETA = calculateETA