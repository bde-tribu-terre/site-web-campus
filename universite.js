// Localisations extérieures.
const VERSION_FILE_URL = "/version.txt";
const API_BASE_URL = "https://api.bde-tribu-terre.fr/v2.0/university/";

// Instanciation de l'objet carte.
let campusMap = L.map('map');

// Initialisation du visuel, via l'API Mapbox. Le token est public : lecture seule.
L.tileLayer(
    "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
    {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: "tribu-terre/ckcm8zb851eor1jo4hbtehlaw",
        tileSize: 512,
        zoomOffset: -1,
        pitch: 20,
        accessToken: "pk.eyJ1IjoidHJpYnUtdGVycmUiLCJhIjoiY2tjdGJ6aml3MHZ2YjJ5bHdkNWMwMDU2MiJ9.ERo6ou9VlclQ8_3Ec8hbnA"
    }
).addTo(campusMap);

// Vision au centre du campus.
campusMap.setView(L.latLng(47.843513, 1.934346), 15);

// Enregistrement de la bulle de crédits.
let creditsCard = L.control({position: "bottomright"});

creditsCard.onAdd = function () {
    let div = L.DomUtil.create("div", "leaflet-control-attribution leaflet-control");
    div.innerHTML = 'Anaël BARODINE <!-- Un plaisir ;) -->| <a href="https://bde-tribu-terre.fr">Tribu-Terre</a>';
    fetch(VERSION_FILE_URL).then(response => response.text().then(text => {div.innerHTML += " | v" + text}));
    return div;
}

creditsCard.addTo(campusMap);

// Enregistrement du popup de description.
let infoPopUp = L.control();
infoPopUp.onAdd = function () {
    this._div = L.DomUtil.create('div', '');
    this.update();
    return this._div;
};
infoPopUp.update = function (buildingProperties) {
    this._div.innerHTML =
        buildingProperties ?
            '<span class="pc"><b>' + buildingProperties.short_label + '</b></span><br><h4>' + buildingProperties.building_group_id + '</h4>'
            : 'Survolez/Touchez un bâtiment en surbrillance pour l\'identifier';
};
infoPopUp.addTo(campusMap);

// Mises à jour du popup de description.
let knownE = [];

function highlightFeature(e) {
    knownE.push(e);
    e.target.setStyle({weight: 5, fillOpacity: 0.8});
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        e.target.bringToFront();
    }
    infoPopUp.update(e.target.feature.geometry.properties);
}

function resetHighlight(e) {
    e.target.setStyle(e.target.feature.geometry.properties.initialStyle);
    infoPopUp.update();
}

let selected;
function clickTouch(e) {
    if (selected) {resetHighlight(selected)}
    selected = e;
    knownE.forEach(e => resetHighlight(e));
    highlightFeature(e);
}

function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: clickTouch
    });
}

// Tableau de couleur des groupes de bâtiments.
let buildingGroupsColors = {};

// Récupération des paramètres de recherche.
let searchParams = new URLSearchParams(window.location.search);

// Est-ce que l'on sait les bâtiments à afficher ?
if (searchParams.has("buildings")) { // Si oui alors on n'affiche qu'eux.
    // Ensemble des ID des bâtiments à fetch pour affichage.
    let buildingsToFetch = [];

    // Reconnaissance des ID des bâtiments à fetch selon le paramètre GET "buildings". Regex : /^([0-9]+)(,[0-9]+)*$/
    searchParams.get("buildings").split(",").forEach(s => {
        buildingsToFetch.push(parseInt(s));
    });

    // On cherche tous les groupes de bâtiments quand même pour pouvoir avoir les couleurs.
    fetch(API_BASE_URL + "buildingGroup/", {
        method: "GET",
        headers: {
            "Accept": "application/json"
        }
    }).then(response => response.json().then(value => {
        // Grâce à la liste des ID des groupes de bâtiments, on peut chercher les groupes précis pour avoir les bâtiments.
        fetch(API_BASE_URL + "buildingGroup/?id=" + value.data.objects.join(","), {
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        }).then(response => response.json().then(value => {
            value.data.objects.forEach(object => {
                buildingGroupsColors[object.building_group_id] = object.color.hex;
            });

            fetchBuildings(buildingsToFetch);
        }));
    }));
} else { // Sinon, on affiche tous les bâtiments sans exception.
    // Ensemble des ID des bâtiments à fetch pour affichage.
    let buildingsToFetch = [];

    // On cherche tous les groupes de bâtiments.
    fetch(API_BASE_URL + "buildingGroup/", {
        method: "GET",
        headers: {
            "Accept": "application/json"
        }
    }).then(response => response.json().then(value => {
        // Grâce à la liste des ID des groupes de bâtiments, on peut chercher les groupes précis pour avoir les bâtiments.
        fetch(API_BASE_URL + "buildingGroup/?id=" + value.data.objects.join(","), {
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        }).then(response => response.json().then(value => {
            value.data.objects.forEach(object => {
                object.buildings.forEach(value => buildingsToFetch.push(value))
                buildingGroupsColors[object.building_group_id] = object.color.hex;
            });

            fetchBuildings(buildingsToFetch);
        }));
    }));
}

// Fetching des bâtiments, 20 par 20 (appel dans les deux conditionnelles juste au-dessus).
function fetchBuildings(buildingsToFetch) {
    let nextBuildintFetch = [];
    for (let i = 0; i < buildingsToFetch.length; i++) {
        nextBuildintFetch.push(buildingsToFetch[i]);

        if (i === buildingsToFetch.length - 1 || (i + 1) % 20 === 0) {
            fetch(API_BASE_URL + "building/?geoJson&id=" + nextBuildintFetch.join(","), {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            }).then(response => response.json().then(value => {
                value.data.objects.forEach(object => {
                    L.geoJSON(
                        {
                            type: object.geo_json.type,
                            properties: {
                                index: object.building_id,
                                initialStyle: {
                                    weight: 2,
                                    color: buildingGroupsColors[object.building_group_id],
                                    opacity: 1,
                                    fillColor: buildingGroupsColors[object.building_group_id],
                                    fillOpacity: 0.6
                                },
                                building_id: object.building_id,
                                building_group_id: object.building_group_id,
                                short_label: object.short_label,
                                long_label: object.long_label
                            },
                            coordinates: object.geo_json.coordinates
                        },
                        {
                            style: {
                                weight: 2,
                                color: buildingGroupsColors[object.building_group_id],
                                opacity: 1,
                                fillColor: buildingGroupsColors[object.building_group_id],
                                fillOpacity: 0.6
                            },
                            onEachFeature: onEachFeature
                        }
                    ).addTo(campusMap);
                });
            }));

            nextBuildintFetch = [];
        }
    }
}

// Ajouter de nouveaux bâtiments :
// https://www.openstreetmap.org/way/39838231
// http://overpass-turbo.eu/#
// https://foucaultvsnorm.sciencesconf.org/data/pages/plan_5.png
