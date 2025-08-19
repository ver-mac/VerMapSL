// Comments added by Github Copilot,
// I didn't bother adding them myself when I first wrote the code.

const { DateTime } = luxon;

let markers = {};
let markerData = {};
let map;
let startDate, endDate;
let sliderMin, sliderMax, minTime;
let playInterval;
let autoRefreshInterval;
let hideDeviceOff = true;
let isAutoRefreshEnabled = false;



const createIcon = (url) => L.icon({
    iconUrl: url,
    iconSize: [45, 45],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});

const transparentIcon = createIcon('image/transparent.png');

function initializeMap() {
    map = L.map('map').setView([46.827465, -71.38314], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);
}

function getIconForOrganisation(organisationName, sasType, status) {
    let iconUrl;
    if (status === 'Device Off') {
        if (hideDeviceOff) {
            return transparentIcon;
        } else {
            iconUrl = 'image/tagOFF.png';
        }
    } else {
        iconUrl = `https://dev.jamlogic.com/Content/images/${sasType}.svg`;
    }
    return createIcon(iconUrl);
}

let domain = 'dev';

function updateLinks(domain) {
    // Logic to update links based on the domain
    console.log(`Updating links for domain: ${domain}`);
    // Example logic
    const links = document.querySelectorAll('a');
    links.forEach(link => {
        link.href = `${domain}${link.getAttribute('href')}`;
    });
}

let selectedOrgId = 0;
let lastOrgName = '';

let credentials = '';


const SECRET_KEY = 'VerMapSL_Secret_Key';

async function importKey() {
    const enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(SECRET_KEY), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encrypt(text) {
    const key = await importKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const data = btoa(String.fromCharCode(...new Uint8Array(cipher)));
    const ivString = btoa(String.fromCharCode(...iv));
    return { iv: ivString, data };
}

async function decrypt(stored) {
    const key = await importKey();
    const iv = new Uint8Array(atob(stored.iv).split('').map(c => c.charCodeAt(0)));
    const data = new Uint8Array(atob(stored.data).split('').map(c => c.charCodeAt(0)));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plain);
}

async function loadStoredCredentials() {
    const saved = localStorage.getItem('lastLogin');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            let dataObj;
            if (parsed && parsed.iv && parsed.data) {
                const decrypted = await decrypt(parsed);
                dataObj = JSON.parse(decrypted);
            } else {
                dataObj = parsed;
            }
            if (dataObj.username) document.getElementById('username').value = dataObj.username;
            if (dataObj.password) document.getElementById('password').value = dataObj.password;
            if (dataObj.orgId) selectedOrgId = dataObj.orgId;
            if (dataObj.orgName) lastOrgName = dataObj.orgName;

        } catch (e) {
            console.error('Failed to parse stored credentials', e);
        }
    }
}

async function saveCredentials() {

    try {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const data = { username, password, orgId: selectedOrgId, orgName: lastOrgName };
        const encrypted = await encrypt(JSON.stringify(data));
        localStorage.setItem('lastLogin', JSON.stringify(encrypted));

    } catch (e) {
        console.error('Failed to save credentials', e);
    }
}

loadStoredCredentials();

function initializeDOMContentLoaded() {
    const labels = ['Dev', 'Svr1', 'Svr2']; 
    let currentIndex = 0;
    const devButton = document.getElementById('dev-button');
    const devLabel = document.getElementById('dev-label');

    function fetchOrganizations(domain) {
        const orgLink = `https://${domain}.jamlogic.com/vmapi/getallorganizationsforuser`;
        fetch(orgLink, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${credentials}`
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    // Show error message for invalid login
                    showLoginError('Invalid username or password. Please try again.');
                } else {
                    showLoginError(`Error: ${response.statusText}`);
                }
                throw new Error('Login failed');
            }
            return response.json();
        })
        
        .then(data => {
            const orgName = {};

            data.forEach(item => {
                orgName[item.Name] = { Name: item.Name, Id: item.Id };
            });
            
            console.log("Name Object:", orgName);
      
            // Populate the dropdown with org names
            const orgNamesContainer = document.getElementById('orgNamesContainer');
            const searchBar = document.getElementById('searchBar');
            const selectOrgButton = document.querySelector('.dropbtn');
            const dropdownContent = document.querySelector('.dropdown-content');

            function populateOrgNames(filter = '') {
                orgNamesContainer.innerHTML = ''; 
                const sortedNames = Object.keys(orgName).sort((a, b) => a.localeCompare(b));
            
                sortedNames.forEach(name => {
                    if (name.toLowerCase().includes(filter.toLowerCase())) {
                        const orgElement = document.createElement('button');
                        orgElement.type = 'button';
                        orgElement.textContent = name;
                        orgElement.addEventListener('click', () => {
                            selectedOrgId = orgName[name].Id;
                            console.log('Selected Org ID:', selectedOrgId);
                            selectOrgButton.textContent = name;
                            dropdownContent.classList.remove('show'); // Close dropdown on select
                            lastOrgName = name;
                            saveCredentials();
                        });
                        orgNamesContainer.appendChild(orgElement);
                    }
                });
            }

            selectOrgButton.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent window click from closing immediately
                dropdownContent.classList.toggle('show');
            });

            // Close dropdown when clicking outside
            window.addEventListener('click', function(e) {
                if (!e.target.closest('.dropdown')) {
                    dropdownContent.classList.remove('show');
                }
            });

            // Filter org names on search
            searchBar.addEventListener('input', function() {
                populateOrgNames(this.value);
            });

            // Initial population
            populateOrgNames();
            if (lastOrgName && orgName[lastOrgName]) {
                selectedOrgId = orgName[lastOrgName].Id;
                selectOrgButton.textContent = lastOrgName;
            }

            // Add event listener to search bar
            searchBar.addEventListener('input', (event) => {
                const filter = event.target.value;
                populateOrgNames(filter);
            });
        })
        .catch(error => {
            console.error('Error fetching org data:', error);
        });
    }
    

    // Initial fetch for the default domain
    fetchOrganizations(domain);

    devButton.addEventListener('click', function() {
        currentIndex = (currentIndex + 1) % labels.length;
        devLabel.textContent = labels[currentIndex];
        
        switch (labels[currentIndex]) {
            case 'Dev':
                domain = 'dev';
                break;
            case 'Svr1':
                domain = 'svr1';
                break;
            case 'Svr2':
                domain = 'svr2';
                break;
        }
        updateLinks(domain);
        
        // Clear the dropdown content before fetching new data
        const orgNamesContainer = document.getElementById('orgNamesContainer');
        orgNamesContainer.innerHTML = '';
        
        fetchOrganizations(domain);
    });
}



document.getElementById('login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (username && password) {
        credentials = btoa(`${username}:${password}`); // Encode credentials in Base64

        // Try to fetch organizations to validate credentials
        fetch(`https://${domain}.jamlogic.com/vmapi/getallorganizationsforuser`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${credentials}`
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    showLoginError('Invalid username or password. Please try again.');
                } else {
                    showLoginError(`Error: ${response.statusText}`);
                }
                throw new Error('Login failed');
            }
            return response.json();
        })
        .then(data => {
            updateLinks();
            initializeDOMContentLoaded(); // Refresh the DOMContentLoaded logic

            // Hide the credentials container only on successful login
            const credentialsContainer = document.getElementById('credentials-container');
            credentialsContainer.style.display = 'none';
            saveCredentials();
        })
        .catch(error => {
            // Credentials popup stays visible, error message is shown
            console.error('Login error:', error);
        });
    } else {
        showLoginError('Please enter both email and password. ');
    }
});

function showLoginError(message) {
    let errorDiv = document.getElementById('login-error');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'login-error';
        errorDiv.style.color = 'red';
        errorDiv.style.marginTop = '10px';
        document.getElementById('credentials-container').appendChild(errorDiv);
    }
    errorDiv.textContent = message;
}

document.addEventListener('DOMContentLoaded', initializeDOMContentLoaded);

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    startDateInput.value = today;
    endDateInput.value = today;

    startDateInput.addEventListener('change', () => {
        endDateInput.value = startDateInput.value;
    });
});

// Function to fetch data based on the selected date range and user input
function fetchData(clearMarkers = true) {

    Object.keys(markers).forEach(markerName => {
        map.removeLayer(markers[markerName]);
    });
    markers = {};
    markerData = {};

    
    startDate = DateTime.fromISO(document.getElementById('start-date').value, { zone: 'America/New_York' }).set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
    endDate = DateTime.fromISO(document.getElementById('end-date').value, { zone: 'America/New_York' }).set({ hour: 23, minute: 59, second: 59, millisecond: 999 });
    
    // Check if both dates are selected
    if (!startDate || !endDate) {
        alert('Please select both start and end dates.');
        return;
    }
    // Format the dates to UTC and then to a specific string format
    const formattedStartDate = formatDate(startDate.toUTC().toISO());
    const formattedEndDate = formatDate(endDate.toUTC().toISO());
    
    // Function to format date with time
    function formatDate(dateString) {
        const date = DateTime.fromISO(dateString, { zone: 'America/New_York' });
        return date.toFormat('yyyy/MM/dd HH:mm');
    }
    
    // Function to format date without time
    function formatDateNoTime(dateString) {
        const date = DateTime.fromISO(dateString, { zone: 'America/New_York' });
        return date.toFormat('yyyy/MM/dd');
    }
    
    // Log the formatted start and end dates to the console
    console.log('Selected Start Date:', formattedStartDate);
    console.log('Selected End Date:', formattedEndDate);
    
    // Check if the user input is valid
    if (!selectedOrgId) {
        alert('Please select an organization.');
        return;
    }
    
    // Generate the URL based on the selected domain, organization ID, and date range
    const urls = [
            `https://${domain}.jamlogic.com/vmApi/getlogs?orgId=${selectedOrgId}&startDate=${formatDateNoTime(startDate.toUTC().toISO())}%2000:00&endDate=${formatDateNoTime(endDate.toUTC().toISO())}%2023:59&logs=Position-Latitude&logs=Status&additionalInfo=type&additionalInfo=sastype&includeLast=${includeLast}`,
        ];
   
        // Display the generated URL
        const savedData = document.getElementById("savedData");
        
        if (savedData) {
            savedData.textContent = urls[0];
        }
        
        console.log("Generated URL:", urls[0]);
        
        // Only clear markers if not in auto-refresh mode
        if (clearMarkers && !isAutoRefreshEnabled) {
            Object.keys(markers).forEach(markerName => {
            map.removeLayer(markers[markerName]);
            
        });
        markers = {}; // Reset the markers object
    }

    // Create and show the loading popup if not in auto-refresh mode
    if (!isAutoRefreshEnabled) {
        const loadingPopup = document.createElement('div');
        loadingPopup.id = 'loadingPopup';
        loadingPopup.style.position = 'fixed';
        loadingPopup.style.top = '0';
        loadingPopup.style.left = '0';
        loadingPopup.style.width = '100%';
        loadingPopup.style.height = '100%';
        loadingPopup.style.background = 'rgba(0,0,0,0.5)';
        loadingPopup.style.color = '#fff';
        loadingPopup.style.display = 'flex';
        loadingPopup.style.justifyContent = 'center';
        loadingPopup.style.alignItems = 'center';
        loadingPopup.style.zIndex = '9999';
        loadingPopup.innerHTML = '<div>Loading...</div>';
        document.body.appendChild(loadingPopup);
    }

    // Function to fetch data from a given URL
    const fetchDataFromUrl = (url) => {
        return fetch(url, {
            headers: {
                'Authorization': `Basic ${credentials}` // Use basic authentication with provided credentials
            }
        })
            .then(response => response.json()) // Parse the response as JSON
            .then(data => {
                console.log('Fetched Data from', url, data); // Log the fetched data for debugging
                
                // Map the fetched data to extract position latitude values
                return data.map(item => {
                    const positionLatitude = item.Logs.find(log => log.Name === 'Position-Latitude')?.Values.map(value => ({
                        T: DateTime.fromISO(value.T, { zone: 'America/New_York' }).toUTC().toISO(),
                        V: value.V // Extract the value
                    })) || [];

                    const status = item.Logs.find(log => log.Name === 'Status')?.Values.map(value => {
                        const filteredValue = value.V.replace('Defective pixel(s), ', '').replace(', Defective pixel(s)', '');
                        return {
                            T: DateTime.fromISO(value.T, { zone: 'America/New_York' }).toUTC().toISO(),
                            V: filteredValue || 'OK' // Default to 'OK' if filtered value is empty
                        };
                    }) || [];
                    
                    // Return an object containing the values
                    return {
                        Name: item.Name,
                        OrganisationName: item.OrganisationName,
                        SasType: item.SasType, 
                        PositionLatitude: positionLatitude,
                        Status: status
                    };
                });
            });
        };

        Promise.all(urls.map(fetchDataFromUrl))
            .then(resultsArray => {
                const combinedResults = resultsArray.flat();
                markerData = combinedResults.reduce((acc, item) => {
                    acc[item.Name] = {
                        positions: item.PositionLatitude.map(pos => ({
                            timestamp: DateTime.fromISO(pos.T, { zone: 'America/New_York' }).toMillis(),
                            V: pos.V,
                            organisationName: item.OrganisationName,
                            sasType: item.SasType,
                            time: pos.T // <-- use pos.T for each position
                        })),
                        statuses: item.Status.map(stat => ({
                            timestamp: DateTime.fromISO(stat.T, { zone: 'America/New_York' }).toMillis(),
                            value: stat.V
                        }))
                    };
                    return acc;
                }, {});

                // Calculate slider range based on total minutes
                const totalMinutes = Math.floor((endDate.toMillis() - startDate.toMillis()) / (1000 * 60));
                document.getElementById('time-slider').setAttribute('min', '0');
                document.getElementById('time-slider').setAttribute('max', totalMinutes.toString());
                sliderMin = 0;
                sliderMax = totalMinutes;
                minTime = startDate.toMillis(); // Set minTime to start of the start date

                // Wait for 1 second before updating markers
                setTimeout(updateMarkers, 1000);

                document.getElementById('time-slider').addEventListener('input', (event) => {
                    const sliderValue = parseInt(event.target.value, 10);
                    minTime = startDate.toMillis() + sliderValue * 60 * 1000;
                    updateMarkers();
                    document.getElementById('slider-value').textContent = `${DateTime.fromMillis(minTime, { zone: 'America/New_York' }).toFormat('yyyy/MM/dd HH:mm')}`;
                });
            })
            .catch(error => console.error('Error fetching data:', error))
            .finally(() => {
            // Remove the loading popup if not in auto-refresh mode
                
            if (!isAutoRefreshEnabled) {
                    const loadingPopup = document.getElementById('loadingPopup');
                    
                    if (loadingPopup) {
                        document.body.removeChild(loadingPopup);
                    }
                }
            });
    }

    document.getElementById('fetch-data').addEventListener('click', function() {
    document.getElementById('slider-container').style.display = 'block';
});

function updateMarkers() {
    const markerNamesContainer = document.getElementById('marker-names-container');
    markerNamesContainer.innerHTML = ''; // Clear previous marker names

    // Iterate over each marker in the markerData
    Object.keys(markerData).forEach(markerName => {
        const { positions, statuses } = markerData[markerName];
        
        // Find the latest position before the current time (minTime)
        const latestPosition = positions.reduce((latest, pos) => pos.timestamp <= minTime ? pos : latest, { timestamp: -Infinity });
        
        let markerStatus = 'OK'; // Default marker status
    
        // Find the most recent status value before the current time
        for (const status of statuses) {
            if (status.timestamp <= minTime) {
                // Prioritize "Device Off" and ignore "Defective pixel(s)"
                let statusValue = status.value.split(', ').filter(s => s !== 'Defective pixel(s)');
                
                if (statusValue.includes('Device Off')) {
                    markerStatus = 'Device Off';
                
                } else if (statusValue.length > 0) {
                    markerStatus = statusValue[0]; // Use the first remaining status
                }
            }
        }

        // Check if the latest position is valid
        if (latestPosition.timestamp !== -Infinity) {
            
            // If the position value is a string, split it into latitude and longitude
            let latLng = [0, 0];
            if (typeof latestPosition.V === 'string') {
                latLng = latestPosition.V.split(',').map(coord => parseFloat(coord.trim()));
            
            } else if (Array.isArray(latestPosition.V)) {
                // If the position value is an array, map it to latitude and longitude
                latLng = latestPosition.V.map(coord => parseFloat(coord));
            
            } else {
                console.warn('Unexpected format for position.V:', latestPosition.V);
                return;
            }

            // Get the appropriate icon for the marker based on the organization, SasType, and status
            const markerIcon = getIconForOrganisation(latestPosition.organisationName, latestPosition.sasType, markerStatus);
            
            // Create the content for the marker's popup
            const popupContent = `<b>${markerName}</b><br>
            Organisation: ${latestPosition.organisationName}<br>
            Status: ${markerStatus}<br>
            Position: ${latLng[0]}, ${latLng[1]}<br>
            Time: ${latestPosition.time ? DateTime.fromISO(latestPosition.time, { zone: 'America/New_York' }).toFormat('yyyy/MM/dd HH:mm:ss') : 'N/A'}`;
           
            // Check if the marker already exists on the map
            if (!markers[markerName]) {
                // Create a new marker and add it to the map
                markers[markerName] = L.marker(latLng, { icon: markerIcon })
                    .addTo(map)
                    .bindPopup(popupContent);
            
                } else {
                // Update the existing marker's position, icon, and popup content
                markers[markerName].setLatLng(latLng)
                    .setIcon(markerIcon)
                    .setPopupContent(popupContent);
            }
            // Only hide markers that currently have "Device Off" status
            if (hideDeviceOff && markerStatus === 'Device Off') {
                map.removeLayer(markers[markerName]);
            
            } else {
                if (!map.hasLayer(markers[markerName])) {
                    markers[markerName].addTo(map);
                }
            }
        
        } else if (markers[markerName]) {
            // Remove the marker if the position is invalid
            map.removeLayer(markers[markerName]);
            delete markers[markerName];
        }

        // Append the marker name as a button to the container
        const markerNameButton = document.createElement('button');
        markerNameButton.type = 'button';
        markerNameButton.textContent = markerName;
        markerNameButton.addEventListener('click', () => {
            if (markers[markerName]) {
                map.panTo(markers[markerName].getLatLng()); // Center the map on the marker without zooming
                markers[markerName].openPopup(); // Open the marker's popup
            }
        });
        markerNamesContainer.appendChild(markerNameButton);
    });
}

let includeLast = false;
const button = document.getElementById('includeLastButton');

button.addEventListener('click', function() {
    includeLast = !includeLast;
    button.textContent = includeLast ? 'Exclude Last Known' : 'Include Last';
    fetchData();
});

function autoUpdateSliderAndMarkers() {
    const currentDateTime = DateTime.now().setZone('America/New_York');
    const minutesSinceStart = Math.floor((currentDateTime - startDate) / (1000 * 60));
    document.getElementById('time-slider').value = minutesSinceStart;
    minTime = startDate.toMillis() + minutesSinceStart * 60 * 1000;
    updateMarkers();
    document.getElementById('slider-value').textContent = `${currentDateTime.toFormat('yyyy/MM/dd HH:mm')}`;
}

document.getElementById('fetch-data').addEventListener('click', () => fetchData(true));
document.getElementById('time-slider').addEventListener('input', (event) => {
    const sliderValue = parseInt(event.target.value, 10);
    minTime = startDate.toMillis() + sliderValue * 60 * 1000;
    updateMarkers();
    document.getElementById('slider-value').textContent = `${DateTime.fromMillis(minTime, { zone: 'America/New_York' }).toFormat('yyyy/MM/dd HH:mm')}`;
});



document.getElementById('auto-refresh-button').addEventListener('click', () => {
    if (autoRefreshInterval) {
        // Stop auto-refresh
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        isAutoRefreshEnabled = false;
        includeLast = false; // Set includeLast to false when auto-refresh is disabled
        document.getElementById('auto-refresh-button').textContent = 'Enable Live';
    
    } else {
        // Enable auto-refresh
        isAutoRefreshEnabled = true;
        includeLast = true; // Set includeLast to true when auto-refresh is enabled

        // Swap the current state of hideDeviceOff
        hideDeviceOff = !hideDeviceOff;
        document.getElementById('hide-device-off').textContent = hideDeviceOff ? 'Show Device Off' : 'Hide Device Off';
        updateMarkers();

        // Initial call to sync the slider and markers with the current time
        autoUpdateSliderAndMarkers();

        // Fetch data and update markers immediately
        fetchData(false); // Fetch data without clearing markers
        setTimeout(autoUpdateSliderAndMarkers, 1000); // Update markers after data fetch

        autoRefreshInterval = setInterval(() => {
            fetchData(false); // Fetch data without clearing markers
            setTimeout(autoUpdateSliderAndMarkers, 1000); // Update markers after data fetch
        }, 
        10000); // Refresh every 10 seconds

        document.getElementById('auto-refresh-button').textContent = 'Disable Live';
    }
});

document.getElementById('hide-device-off').addEventListener('click', () => {
    hideDeviceOff = !hideDeviceOff;
    document.getElementById('hide-device-off').textContent = hideDeviceOff ? 'Show Device Off' : 'Hide Device Off';
    updateMarkers();
});

// Play/Pause button logic for slider animation
document.getElementById('speed-buttons').addEventListener('click', (event) => {
    const button = event.target;

    // Ensure the clicked element is a button with a data-speed attribute
    if (button.tagName === 'BUTTON' && button.hasAttribute('data-speed')) {
        const displaySpeed = button.getAttribute('data-speed');

        // Map display speeds to actual interval speeds (in milliseconds)
        const speedMapping = {
            
            '0.25': 1500, // Slowest
            '0.5': 1000,
            '1': 600,    // Normal speed
            '1.5': 400,   
            '2': 100      // Fastest
        };

        const playSpeed = speedMapping[displaySpeed];

        if (playSpeed) {
            // Clear any existing interval
            if (playInterval) {
                clearInterval(playInterval);
            }

            // Set a new interval with the updated speed
            playInterval = setInterval(() => {
                const timeSlider = document.getElementById('time-slider');
                if (parseInt(timeSlider.value, 10) < sliderMax) {
                    timeSlider.value = parseInt(timeSlider.value, 10) + 1;
                    const sliderValue = parseInt(timeSlider.value, 10);
                    minTime = startDate.toMillis() + sliderValue * 60 * 1000;
                    updateMarkers();
                    document.getElementById('slider-value').textContent = `${DateTime.fromMillis(minTime, { zone: 'America/New_York' }).toFormat('yyyy/MM/dd HH:mm')}`;
                } else {
                    clearInterval(playInterval);
                    playInterval = null;
                    
                }
            }, playSpeed);
        }
    }
});

document.getElementById('pause-button').addEventListener('click', () => {
    if (playInterval) {
        clearInterval(playInterval); // Stop the interval
        playInterval = null; // Reset the interval reference
        
    }
});

document.getElementById('auto-refresh-button').addEventListener('click', () => {
    // Auto-refresh button logic
});


function displayTimezone() {
    const timezoneOffset = DateTime.local().offset;
    const sign = timezoneOffset >= 0 ? '+' : '-';
    const offsetHours = Math.abs(Math.floor(timezoneOffset / 60));
    const offsetMinutes = Math.abs(timezoneOffset % 60);
    const timezoneString = `GMT${sign}${offsetHours}:${offsetMinutes < 10 ? '0' : ''}${offsetMinutes}`;
    document.getElementById('timezone').textContent = `(${timezoneString})`;
}

window.onload = () => {
    initializeMap();
    displayTimezone();
};