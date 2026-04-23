// Wait for the page to fully load before trying to create the map
document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM loaded, initializing map...");

    // Create the map
    var map = L.map('map').setView([39.8283, -98.5795], 4);

    // Add the tile layer (the actual map imagery)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Example locations - COMMENTED OUT
    /*
    var locations = [
        {
            lat: 40.7128,
            lng: -74.0060,
            name: "New York City",
            description: "📍 Times Square, Broadway shows, iconic skyline"
        },
        ...
    ];

    // Add markers to the map
    for (var i = 0; i < locations.length; i++) {
        var loc = locations[i];
        var marker = L.marker([loc.lat, loc.lng]).addTo(map);
        marker.bindPopup('<strong>' + loc.name + '</strong><br>' + loc.description);
    }
    */

    // Layer groups for filtering
    var layers = {
        pipelines: {
            oil: L.layerGroup().addTo(map),
            ngl: L.layerGroup().addTo(map),
            lpg: L.layerGroup().addTo(map),
            other: L.layerGroup().addTo(map)
        },
        extraction: {
            oil: L.layerGroup().addTo(map),
            gas: L.layerGroup().addTo(map),
            other: L.layerGroup().addTo(map)
        }
    };

    // Custom Legend Control
    var legend = L.control({ position: 'bottomright' });

    legend.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'legend');
        div.innerHTML = '<h4>Infrastructure</h4>' +
            '<div class="legend-item"><input type="checkbox" id="pipe-oil" checked> <span class="color-key" style="background: #e74c3c"></span>Oil Pipelines</div>' +
            '<div class="legend-item"><input type="checkbox" id="pipe-ngl" checked> <span class="color-key" style="background: #3498db"></span>NGL Pipelines</div>' +
            '<div class="legend-item"><input type="checkbox" id="pipe-lpg" checked> <span class="color-key" style="background: #f1c40f"></span>LPG Pipelines</div>' +
            '<div class="legend-item"><input type="checkbox" id="pipe-other" checked> <span class="color-key" style="background: #34495e"></span>Other Pipelines</div>' +
            '<h4>Extraction</h4>' +
            '<div class="legend-item"><input type="checkbox" id="ext-oil" checked> <span class="color-key circle" style="background: #c0392b"></span>Oil Projects</div>' +
            '<div class="legend-item"><input type="checkbox" id="ext-gas" checked> <span class="color-key circle" style="background: #27ae60"></span>Gas Projects</div>' +
            '<div class="legend-item"><input type="checkbox" id="ext-other" checked> <span class="color-key circle" style="background: #8e44ad"></span>Other/Mixed</div>';

        // Prevent map clicks when clicking legend
        L.DomEvent.disableClickPropagation(div);
        return div;
    };

    legend.addTo(map);

    // Filter Logic
    function setupToggles() {
        var toggleMap = {
            'pipe-oil': layers.pipelines.oil,
            'pipe-ngl': layers.pipelines.ngl,
            'pipe-lpg': layers.pipelines.lpg,
            'pipe-other': layers.pipelines.other,
            'ext-oil': layers.extraction.oil,
            'ext-gas': layers.extraction.gas,
            'ext-other': layers.extraction.other
        };

        Object.keys(toggleMap).forEach(function (id) {
            document.getElementById(id).addEventListener('change', function (e) {
                if (this.checked) {
                    map.addLayer(toggleMap[id]);
                } else {
                    map.removeLayer(toggleMap[id]);
                }
            });
        });
    }

    // Load Pipeline Data
    console.log("Loading pipeline data...");
    fetch('./mapData/GEM-GOIT-Oil-NGL-Pipelines-2025-03.geojson')
        .then(response => response.json())
        .then(data => {
            console.log("Pipeline data loaded successfully");
            L.geoJSON(data, {
                style: function (feature) {
                    var fuel = feature.properties.Fuel || 'Unknown';
                    var color = '#34495e';
                    if (fuel.includes('Oil')) color = '#e74c3c';
                    else if (fuel.includes('NGL')) color = '#3498db';
                    else if (fuel.includes('LPG')) color = '#f1c40f';
                    return { color: color, weight: 3, opacity: 0.8 };
                },
                onEachFeature: function (feature, layer) {
                    if (feature.properties) {
                        var popupContent = '<strong>' + (feature.properties.PipelineName || 'Unnamed Pipeline') + '</strong><br>' +
                            'Fuel: ' + (feature.properties.Fuel || 'N/A') + '<br>' +
                            'Status: ' + (feature.properties.Status || 'N/A') + '<br>' +
                            'Countries: ' + (feature.properties.Countries || 'N/A');
                        layer.bindPopup(popupContent);

                        // Add to appropriate layer group
                        var fuel = feature.properties.Fuel || '';
                        if (fuel.includes('Oil')) layer.addTo(layers.pipelines.oil);
                        else if (fuel.includes('NGL')) layer.addTo(layers.pipelines.ngl);
                        else if (fuel.includes('LPG')) layer.addTo(layers.pipelines.lpg);
                        else layer.addTo(layers.pipelines.other);
                    }
                }
            });
        })
        .catch(error => console.error("Error loading pipeline data:", error));

    // Load Extraction Tracker Data (CSV)
    console.log("Loading extraction data...");
    Papa.parse('./mapData/Global-Oil-and-Gas-Extraction-Tracker-March-2026 Project-level main data.csv', {
        download: true,
        header: true,
        complete: function (results) {
            console.log("Extraction data loaded successfully", results.data.length + " rows");
            results.data.forEach(function (row) {
                var lat = parseFloat(row.Latitude);
                var lng = parseFloat(row.Longitude);

                if (!isNaN(lat) && !isNaN(lng)) {
                    var fuel = (row['Fuel type'] || '').toLowerCase();
                    var color = fuel.includes('oil') ? '#c0392b' : (fuel.includes('gas') ? '#27ae60' : '#8e44ad');

                    var circle = L.circleMarker([lat, lng], {
                        radius: 6,
                        fillColor: color,
                        color: "#fff",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    });

                    var popupContent = '<strong>' + (row['Project Name'] || 'Unnamed Project') + '</strong><br>' +
                        'Type: ' + (row['Fuel type'] || 'N/A') + '<br>' +
                        'Status: ' + (row['Status'] || 'N/A') + '<br>' +
                        'Project ID: ' + (row['Project ID'] || 'N/A');

                    if (row['Wiki URL (project)']) {
                        popupContent += '<br><a href="' + row['Wiki URL (project)'] + '" target="_blank">View Wiki</a>';
                    }

                    circle.bindPopup(popupContent);

                    // Add to appropriate layer group
                    if (fuel.includes('oil')) circle.addTo(layers.extraction.oil);
                    else if (fuel.includes('gas')) circle.addTo(layers.extraction.gas);
                    else circle.addTo(layers.extraction.other);
                }
            });

            // Setup toggles after legend is added to DOM
            setupToggles();
        },
        error: function (error) {
            console.error("Error loading extraction data:", error);
        }
    });

    // Add a scale bar to the map
    L.control.scale({ metric: true, imperial: true }).addTo(map);

    console.log("Map initialized. Data is being loaded...");
});