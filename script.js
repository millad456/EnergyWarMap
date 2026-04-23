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
            oil: L.layerGroup(),
            ngl: L.layerGroup(),
            lpg: L.layerGroup(),
            other: L.layerGroup()
        },
        projects: {
            oil: L.layerGroup().addTo(map),
            gas: L.layerGroup().addTo(map),
            other: L.layerGroup().addTo(map)
        },
        fields: {
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
            '<div class="legend-item"><input type="checkbox" id="pipe-oil"> <span class="color-key" style="background: #e74c3c; opacity: 0.4"></span>Oil Pipelines</div>' +
            '<div class="legend-item"><input type="checkbox" id="pipe-ngl"> <span class="color-key" style="background: #3498db; opacity: 0.4"></span>NGL Pipelines</div>' +
            '<div class="legend-item"><input type="checkbox" id="pipe-lpg"> <span class="color-key" style="background: #f1c40f; opacity: 0.4"></span>LPG Pipelines</div>' +
            '<div class="legend-item"><input type="checkbox" id="pipe-other"> <span class="color-key" style="background: #34495e; opacity: 0.4"></span>Other Pipelines</div>' +
            '<h4>Projects (Large)</h4>' +
            '<div class="legend-item"><input type="checkbox" id="proj-oil" checked> <span class="color-key circle" style="background: #c0392b"></span>Oil Projects</div>' +
            '<div class="legend-item"><input type="checkbox" id="proj-gas" checked> <span class="color-key circle" style="background: #27ae60"></span>Gas Projects</div>' +
            '<div class="legend-item"><input type="checkbox" id="proj-other" checked> <span class="color-key circle" style="background: #8e44ad"></span>Other/Mixed</div>' +
            '<h4>Fields (Small)</h4>' +
            '<div class="legend-item"><input type="checkbox" id="field-oil" checked> <span class="color-key circle" style="background: #c0392b; width: 8px; height: 8px; margin-left: 8px; margin-right: 18px;"></span>Oil Fields</div>' +
            '<div class="legend-item"><input type="checkbox" id="field-gas" checked> <span class="color-key circle" style="background: #27ae60; width: 8px; height: 8px; margin-left: 8px; margin-right: 18px;"></span>Gas Fields</div>' +
            '<div class="legend-item"><input type="checkbox" id="field-other" checked> <span class="color-key circle" style="background: #8e44ad; width: 8px; height: 8px; margin-left: 8px; margin-right: 18px;"></span>Other Fields</div>';
        
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
            'proj-oil': layers.projects.oil,
            'proj-gas': layers.projects.gas,
            'proj-other': layers.projects.other,
            'field-oil': layers.fields.oil,
            'field-gas': layers.fields.gas,
            'field-other': layers.fields.other
        };

        Object.keys(toggleMap).forEach(function (id) {
            var checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', function (e) {
                    if (this.checked) {
                        map.addLayer(toggleMap[id]);
                    } else {
                        map.removeLayer(toggleMap[id]);
                    }
                });
            }
        });
    }

    // Load Pipeline Data
    fetch('./mapData/GEM-GOIT-Oil-NGL-Pipelines-2025-03.geojson')
        .then(response => response.json())
        .then(data => {
            L.geoJSON(data, {
                style: function (feature) {
                    var fuel = feature.properties.Fuel || 'Unknown';
                    var color = '#34495e';
                    if (fuel.includes('Oil')) color = '#e74c3c';
                    else if (fuel.includes('NGL')) color = '#3498db';
                    else if (fuel.includes('LPG')) color = '#f1c40f';
                    return { color: color, weight: 2, opacity: 0.4 };
                },
                onEachFeature: function (feature, layer) {
                    if (feature.properties) {
                        var popupContent = '<strong>' + (feature.properties.PipelineName || 'Unnamed Pipeline') + '</strong><br>' +
                            'Fuel: ' + (feature.properties.Fuel || 'N/A') + '<br>' +
                            'Status: ' + (feature.properties.Status || 'N/A') + '<br>' +
                            'Countries: ' + (feature.properties.Countries || 'N/A');
                        layer.bindPopup(popupContent);

                        var fuel = feature.properties.Fuel || '';
                        if (fuel.includes('Oil')) layer.addTo(layers.pipelines.oil);
                        else if (fuel.includes('NGL')) layer.addTo(layers.pipelines.ngl);
                        else if (fuel.includes('LPG')) layer.addTo(layers.pipelines.lpg);
                        else layer.addTo(layers.pipelines.other);
                    }
                }
            });
        });

    // Load Project-level Extraction Data
    Papa.parse('./mapData/Global-Oil-and-Gas-Extraction-Tracker-March-2026 Project-level main data.csv', {
        download: true,
        header: true,
        complete: function (results) {
            results.data.forEach(function (row) {
                var lat = parseFloat(row.Latitude);
                var lng = parseFloat(row.Longitude);
                if (!isNaN(lat) && !isNaN(lng)) {
                    var fuel = (row['Fuel type'] || '').toLowerCase();
                    var color = fuel.includes('oil') ? '#c0392b' : (fuel.includes('gas') ? '#27ae60' : '#8e44ad');
                    var marker = L.circleMarker([lat, lng], {
                        radius: 6,
                        fillColor: color,
                        color: "#fff",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    });

                    var popupContent = '<strong>Project: ' + (row['Project Name'] || 'Unnamed') + '</strong><br>' +
                        'Type: ' + (row['Fuel type'] || 'N/A') + '<br>' +
                        'Status: ' + (row['Status'] || 'N/A');
                    if (row['Wiki URL (project)']) popupContent += '<br><a href="' + row['Wiki URL (project)'] + '" target="_blank">GEM Wiki</a>';
                    
                    marker.bindPopup(popupContent);
                    if (fuel.includes('oil')) marker.addTo(layers.projects.oil);
                    else if (fuel.includes('gas')) marker.addTo(layers.projects.gas);
                    else marker.addTo(layers.projects.other);
                }
            });
            setupToggles();
        }
    });

    // Load Field-level Extraction Data
    Papa.parse('./mapData/Global-Oil-and-Gas-Extraction-Tracker-March-2026.xlsx - Field-level main data.csv', {
        download: true,
        header: true,
        complete: function (results) {
            results.data.forEach(function (row) {
                var lat = parseFloat(row.Latitude);
                var lng = parseFloat(row.Longitude);
                if (!isNaN(lat) && !isNaN(lng)) {
                    var fuel = (row['Fuel type'] || '').toLowerCase();
                    var color = fuel.includes('oil') ? '#c0392b' : (fuel.includes('gas') ? '#27ae60' : '#8e44ad');
                    var marker = L.circleMarker([lat, lng], {
                        radius: 3.5,
                        fillColor: color,
                        color: "#fff",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.6
                    });

                    var popupContent = '<strong>Field: ' + (row['Unit Name'] || 'Unnamed') + '</strong><br>' +
                        'Type: ' + (row['Fuel type'] || 'N/A') + '<br>' +
                        'Status: ' + (row['Status'] || 'N/A');
                    if (row['Wiki URL (field)']) popupContent += '<br><a href="' + row['Wiki URL (field)'] + '" target="_blank">GEM Wiki</a>';
                    
                    marker.bindPopup(popupContent);
                    if (fuel.includes('oil')) marker.addTo(layers.fields.oil);
                    else if (fuel.includes('gas')) marker.addTo(layers.fields.gas);
                    else marker.addTo(layers.fields.other);
                }
            });
            setupToggles();
        }
    });

    L.control.scale({ metric: true, imperial: true }).addTo(map);
});