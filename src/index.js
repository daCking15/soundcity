//import * as THREE from 'three';
//import { EffectComposer, RenderPass, UnrealBloomPass } from 'postprocessing';

import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/build/three.module.js';
import {OrbitControls} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/loaders/GLTFLoader.js';
import {GUI} from 'https://threejsfundamentals.org/threejs/../3rdparty/dat.gui.module.js';

let scene, camera, renderer, analyser, dataArray, audio, ground, car;
let buildings = [];
let buildingColors = [];
const roadWidth = 10;
const roadLength = 200;
let buildingGroup = new THREE.Object3D();
const carVelocity = new THREE.Vector3();
const groundRaycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
const carSpeed = 25;
const turnAmount = Math.PI / 4;
const turnProbability = 0.1;
const speedFactor = 100;
let road;
const carForward = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();
const cameraLookAt = new THREE.Vector3();
const maxHeight = 50;
let moonLight, moonGlow;
var stars;

// Controls
let currentSong = '';

// Dirty
const numLasers = 8;
const lasers = [];
const laserColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF, 0xFFFFFF, 0xFF8000];

const minFrequency = 0;
const maxFrequency = 10000;

async function initDirty() {
    // Setup the scene asynchronously
    await new Promise((resolve, reject) => {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 0, 5);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000);
        renderer.useLegacyLights = true;
        document.body.appendChild(renderer.domElement);

        const geometry = new THREE.BoxGeometry(1, 1, 1);

        const buildingWidth = 0.1;
        const buildingOffset = 20; // The distance between the road and the buildings
        const spaceBetweenBuildings = 5; // The space between buildings
        const buildingsPerSide = Math.floor(roadLength / (buildingWidth + spaceBetweenBuildings));
        const numBuildings = buildingsPerSide * 2;

        for (let i = 0; i < numBuildings; i++) {
            const color = new THREE.Color().setHSL(i / numBuildings, 1, 0.5);
            const material = new THREE.MeshPhongMaterial({ color: color, emissive: color, emissiveIntensity: 1.0 });
            const building = new THREE.Mesh(geometry, material);

            let buildingPosition = new THREE.Vector3();
            let side = i % 2 === 0 ? -1 : 1; // Alternate the side of the road
            buildingPosition.x = side * (roadWidth / 2 + buildingOffset);
            buildingPosition.z = ((i % buildingsPerSide) * (buildingWidth + spaceBetweenBuildings)) - roadLength / 2;

            const height = Math.random() * maxHeight + 1;
            building.scale.set(buildingWidth, height, buildingWidth);
            building.position.copy(buildingPosition);
            building.position.y = height / 2;

            // Randomly rotate the building around the x-axis
            const rotationAngle = Math.random() * Math.PI * 2;
            building.rotateX(rotationAngle);

            // Adjust the position after rotation to keep one edge at the same position
            const halfHeight = height / 2;
            const newPosition = new THREE.Vector3(building.position.x, building.position.y - halfHeight, building.position.z);
            building.position.copy(newPosition);

            buildingGroup.add(building);
            buildings.push(building);
            buildingColors.push(new THREE.Color());
        }


        scene.add(buildingGroup);
        camera.position.y = 5;

        // Create a ground plane
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2; // Rotate the ground plane to make it horizontal
        ground.receiveShadow = true; // Enable the ground to receive shadows from buildings and lights
        scene.add(ground);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        scene.add(ambientLight);

        let pointLight = new THREE.PointLight(0xffffff, 1, 100);
        pointLight.position.set(0, 20, 0);
        scene.add(pointLight);

        const listener = new THREE.AudioListener();
        camera.add(listener);

        audio = new THREE.Audio(listener);

        const canvasContainer = document.getElementById('canvasContainer');
        renderer.setSize(window.innerWidth, window.innerHeight);
        canvasContainer.appendChild(renderer.domElement);

        // Optional: If you have a resize event handler, ensure it's adjusting the canvas correctly
        window.addEventListener('resize', onWindowResize, false);

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        analyser = new THREE.AudioAnalyser(audio, 64);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Create a road plane
        const roadGeometry = new THREE.PlaneGeometry(roadWidth, roadLength);
        const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x404040 }); // Dark gray color for the road
        road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2; // Rotate the road plane to make it horizontal
        road.position.y = 0.01; // Raise the road slightly above the ground
        scene.add(road);

        // Create a moon light
        const moonColor = 0xffffff;
        const moonIntensity = 1;
        moonLight = new THREE.PointLight(moonColor, moonIntensity);

        moonLight.position.set(0, 50, roadLength / 2);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.width = 2048;
        moonLight.shadow.mapSize.height = 2048;
        moonLight.shadow.camera.near = 0.1;
        moonLight.shadow.camera.far = 1000;
        moonLight.shadow.camera.fov = 90;
        moonLight.shadow.bias = -0.001;
        moonLight.distance = 100;
        moonLight.shadow.radius = 5;
        scene.add(moonLight);

        // Set the moon light color and intensity
        const moonGlowColor = 0xaaaaaa;
        const moonGlowIntensity = 1;
        moonLight.color.setHex(moonColor);
        moonLight.intensity = moonIntensity;

        // Add a glowing sphere to represent the moon
        const moonGlowGeometry = new THREE.SphereGeometry(10, 32, 32);
        const moonGlowMaterial = new THREE.MeshBasicMaterial({ color: moonGlowColor, transparent: true, opacity: moonGlowIntensity });
        moonGlow = new THREE.Mesh(moonGlowGeometry, moonGlowMaterial);
        moonGlow.position.set(0, 50, roadLength / 2);
        scene.add(moonGlow);

        // Load car model asynchronously
        const loader = new GLTFLoader();
        loader.load(
            // resource URL
            "car.glb",
            // called when the resource is loaded
            function (gltf) {
                car = gltf.scene;
                car.children[0].rotation.z = Math.PI;
                scene.add(car);
                resolve(); // Resolve the promise when the car model is loaded
            },
            // called while loading is progressing
            function (xhr) {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            // called when loading has errors
            function (error) {
                console.log('An error happened', error);
                reject(error); // Reject the promise if there is an error loading the car model
            }
        );

        // Create a group to hold the stars
        stars = new THREE.Group();

        // Create the stars
        for (let i = 0; i < 1000; i++) {
            let starGeometry = new THREE.SphereGeometry(1, 8, 8);
            let starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
            let star = new THREE.Mesh(starGeometry, starMaterial);

            // Position the star randomly within a larger cube
            star.position.x = Math.random() * 2000 - 1000;
            star.position.z = Math.random() * 2000 - 1000;

            // If the star is within a certain distance of the plane, set a minimum height
            if (Math.abs(star.position.z) < 200) {  // Adjust this value as needed
                star.position.y = Math.random() * 500 + 500; // Stars will be created at altitudes between 500 and 1000
            } else {
                star.position.y = Math.random() * 1000;
            }

            // Add the star to the group
            stars.add(star);
        }

        // Add the group of stars to the scene
        scene.add(stars);
    });

}

async function initPlaceholder() {
    // Setup the scene asynchronously
    await new Promise((resolve, reject) => {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 0, 5);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000);
        renderer.useLegacyLights = true;
        document.body.appendChild(renderer.domElement);

        const geometry = new THREE.BoxGeometry(1, 1, 1);

        const buildingWidth = 5;
        const buildingOffset = 20; // The distance between the road and the buildings
        const spaceBetweenBuildings = 10; // The space between buildings
        const buildingsPerSide = Math.floor(roadLength / (buildingWidth + spaceBetweenBuildings));
        const numBuildings = buildingsPerSide * 2;

        for (let i = 0; i < numBuildings; i++) {
            const color = new THREE.Color().setHSL(i / numBuildings, 1, 0.5);
            const material = new THREE.MeshPhongMaterial({ color: color, emissive: color, emissiveIntensity: 1.0 });
            const building = new THREE.Mesh(geometry, material);

            let buildingPosition = new THREE.Vector3();
            let side = i % 2 === 0 ? -1 : 1; // Alternate the side of the road
            buildingPosition.x = side * (roadWidth / 2 + buildingOffset);
            buildingPosition.z = ((i % buildingsPerSide) * (buildingWidth + spaceBetweenBuildings)) - roadLength / 2;

            const height = Math.random() * maxHeight + 1;
            building.scale.set(buildingWidth, height, buildingWidth);
            building.position.copy(buildingPosition);
            building.position.y = height / 2;

            building.scale.set(buildingWidth, (Math.random() * 5 + 1) * 10, buildingWidth);
            building.position.copy(buildingPosition);
            building.position.y = building.scale.y / 2;
            buildingGroup.add(building);
            buildings.push(building);
            buildingColors.push(new THREE.Color());
        }

        scene.add(buildingGroup);
        camera.position.y = 5;

        // Create a ground plane
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2; // Rotate the ground plane to make it horizontal
        ground.receiveShadow = true; // Enable the ground to receive shadows from buildings and lights
        scene.add(ground);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        scene.add(ambientLight);

        let pointLight = new THREE.PointLight(0xffffff, 1, 100);
        pointLight.position.set(0, 20, 0);
        scene.add(pointLight);

        const listener = new THREE.AudioListener();
        camera.add(listener);

        audio = new THREE.Audio(listener);

        const canvasContainer = document.getElementById('canvasContainer');
        renderer.setSize(window.innerWidth, window.innerHeight);
        canvasContainer.appendChild(renderer.domElement);

        // Optional: If you have a resize event handler, ensure it's adjusting the canvas correctly
        window.addEventListener('resize', onWindowResize, false);

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        analyser = new THREE.AudioAnalyser(audio, 64);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Create a road plane
        const roadGeometry = new THREE.PlaneGeometry(roadWidth, roadLength);
        const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x404040 }); // Dark gray color for the road
        road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2; // Rotate the road plane to make it horizontal
        road.position.y = 0.01; // Raise the road slightly above the ground
        scene.add(road);

        // Create a moon light
        const moonColor = 0xffffff;
        const moonIntensity = 1;
        moonLight = new THREE.PointLight(moonColor, moonIntensity);

        moonLight.position.set(0, 50, roadLength / 2);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.width = 2048;
        moonLight.shadow.mapSize.height = 2048;
        moonLight.shadow.camera.near = 0.1;
        moonLight.shadow.camera.far = 1000;
        moonLight.shadow.camera.fov = 90;
        moonLight.shadow.bias = -0.001;
        moonLight.distance = 100;
        moonLight.shadow.radius = 5;
        scene.add(moonLight);

        // Set the moon light color and intensity
        const moonGlowColor = 0xaaaaaa;
        const moonGlowIntensity = 1;
        moonLight.color.setHex(moonColor);
        moonLight.intensity = moonIntensity;

        // Add a glowing sphere to represent the moon
        const moonGlowGeometry = new THREE.SphereGeometry(10, 32, 32);
        const moonGlowMaterial = new THREE.MeshBasicMaterial({ color: moonGlowColor, transparent: true, opacity: moonGlowIntensity });
        moonGlow = new THREE.Mesh(moonGlowGeometry, moonGlowMaterial);
        moonGlow.position.set(0, 50, roadLength / 2);
        scene.add(moonGlow);

        // Load car model asynchronously
        const loader = new GLTFLoader();
        loader.load(
            // resource URL
            "car.glb",
            // called when the resource is loaded
            function (gltf) {
                car = gltf.scene;
                car.children[0].rotation.z = Math.PI;
                scene.add(car);
                resolve(); // Resolve the promise when the car model is loaded
            },
            // called while loading is progressing
            function (xhr) {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            // called when loading has errors
            function (error) {
                console.log('An error happened', error);
                reject(error); // Reject the promise if there is an error loading the car model
            }
        );

        // Create a group to hold the stars
        stars = new THREE.Group();

        // Create the stars
        for (let i = 0; i < 1000; i++) {
            let starGeometry = new THREE.SphereGeometry(1, 8, 8);
            let starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
            let star = new THREE.Mesh(starGeometry, starMaterial);

            // Position the star randomly within a larger cube
            star.position.x = Math.random() * 2000 - 1000;
            star.position.z = Math.random() * 2000 - 1000;

            // If the star is within a certain distance of the plane, set a minimum height
            if (Math.abs(star.position.z) < 200) {  // Adjust this value as needed
                star.position.y = Math.random() * 500 + 500; // Stars will be created at altitudes between 500 and 1000
            } else {
                star.position.y = Math.random() * 1000;
            }

            // Add the star to the group
            stars.add(star);
        }

        // Add the group of stars to the scene
        scene.add(stars);
    });

}

function initHomeScreen() {
    // Set up the home screen elements like the song selection buttons

    const playDirtyButton = document.getElementById('playDirty');
    playDirtyButton.addEventListener('click', function() {
        initDirty().then(() => {
            playSong('Dirty.wav');
            hideElement('songButtons');
            showElement('canvasContainer');
        });
    });

    const playSunGoesDownButton = document.getElementById('playSunGoesDown');
    playSunGoesDownButton.addEventListener('click', function() {
        initPlaceholder().then(() => {
            playSong('Sun Goes Down.wav');
            hideElement('songButtons');
            showElement('canvasContainer');
        });
    });

    const backButton = document.getElementById('backButton');
    backButton.addEventListener('click', goBackToMainScreen);
    
    window.addEventListener('keydown', function(event) {
        // Check if the key pressed is the spacebar
        if (event.code === 'Space') {
            event.preventDefault(); // Prevent any default behavior of the spacebar
            toggleSong(); // Call the function to toggle the song
        }
    });   
}

function hideElement(id) {
    document.getElementById(id).style.display = 'none';
}

function showElement(id) {
    document.getElementById(id).style.display = 'block';
}


function goBackToMainScreen() {
    destroyScene().then(() => {
        document.getElementById('canvasContainer').style.display = 'none';
        document.getElementById('songButtons').style.display = '';
        document.getElementById('backButton').style.display = 'none';
        if (audio.isPlaying) {
            audio.stop();
        }
    });
}

function toggleSong() {
    audio.stop();
    const songs = [
        'Up.wav', 
        'Dirty.wav', 
        "Sun Goes Down.wav", 
        "Bring it.wav", 
        "War.wav", 
        "Legend.wav", 
        "My Time.wav", 
        "No Restarts.wav", 
        "Can't Change.wav", 
        "Burton x8.wav", 
        "Turret.wav", 
        "Next Gear.wav"
    ];

    // Find the index of the current song in the array
    const currentIndex = songs.indexOf(currentSong);

    // Calculate the index of the next song
    const nextIndex = (currentIndex + 1) % songs.length;

    // Get the filename of the next song
    const nextSong = songs[nextIndex];

    destroyScene().then(() => {
        if (nextSong === 'Dirty.wav') {
            initDirty().then(() => {
                playSong(nextSong);
                document.getElementById('canvasContainer').style.display = 'block';
            });
        } else {
            initPlaceholder().then(() => {
                playSong(nextSong);
                document.getElementById('canvasContainer').style.display = 'block';
            });
        }       
    });
}


async function destroyScene() {
    // Remove all objects from the buildingGroup
    buildingGroup.remove.apply(buildingGroup, buildingGroup.children);

    // Dispose geometries and materials asynchronously to free up memory
    await Promise.all(buildingGroup.children.map(async (building) => {
        if (building.geometry) {
            building.geometry.dispose();
        }
        if (building.material) {
            // If the material is an array, dispose each material in the array
            if (Array.isArray(building.material)) {
                await Promise.all(building.material.map(async (material) => {
                    material.dispose();
                    // Dispose textures if applicable
                    if (material.map) {
                        material.map.dispose();
                    }
                }));
            } else {
                building.material.dispose();
                // Dispose textures if applicable
                if (building.material.map) {
                    building.material.map.dispose();
                }
            }
        }
    }));

    // Remove lights and cameras
    scene.remove.apply(scene, scene.children.filter(child => child instanceof THREE.Light || child instanceof THREE.Camera));

    // Reset any global variables or arrays
    buildings = [];
    buildingColors = [];

    // Remove the renderer's canvas element
    const canvasContainer = document.getElementById('canvasContainer');
    if (canvasContainer && canvasContainer.firstChild) {
        canvasContainer.removeChild(canvasContainer.firstChild);
    }

    // Optionally, dispose of the renderer
    renderer.dispose();
}


function playSong(filename) {
    const audioLoader = new THREE.AudioLoader();
    // Update the current song
    currentSong = filename;

    // Your playSong function logic...
    audioLoader.load(filename, (buffer) => {
        // If there's a song already playing, stop it
        if (audio.isPlaying) {
            audio.stop();
        }

        // Set the buffer and play the audio
        audio.setBuffer(buffer);
        audio.setLoop(true);
        audio.setVolume(0.5);
        audio.play();

        // Start the Three.js animation if the song is "Dirty.wav"
        if (filename === 'Dirty.wav') {
            animateDirty();
        } else {
            animatePlaceholder();
        }
    });

    // Hide the song selection buttons
    document.getElementById('songButtons').style.display = 'none';
    document.getElementById('backButton').style.display = 'block';
}


function animateDirty() {
    requestAnimationFrame(animateDirty);

    dataArray = analyser.getFrequencyData();
    const frequency = analyser.getAverageFrequency();

    const buildingLength = 10000; // Set a fixed length for the buildings

    for (let i = 0; i < buildings.length; i++) {
        const frequencyIndex = i / buildings.length * (maxFrequency - minFrequency) + minFrequency;
        const index = Math.floor(frequencyIndex / (maxFrequency - minFrequency) * dataArray.length);
        const normalizedFrequency = dataArray[index] / 256;

        // Rotate the building around the x-axis based on the normalized frequency
        const rotationX = normalizedFrequency * Math.PI; // Adjust the factor to control rotation
        if (rotationX == 0) {
            buildings[i].visible = false;
        } else {
            buildings[i].visible = true;
            buildings[i].rotation.x = rotationX;
        }

        // Set a fixed length for the building
        buildings[i].scale.set(0.1, 0.1, buildingLength);

        const color = new THREE.Color().setHSL(normalizedFrequency, 1, 0.5);
        buildingColors[i].copy(color);
        buildings[i].material.color.copy(buildingColors[i]);
        buildings[i].material.emissive.copy(buildingColors[i]);

        // Position the buildings vertically to ensure they touch the ground
        buildings[i].position.y = 0;
    }
    
    for (let i = 0; i < stars.children.length; i++) {
        const star = stars.children[i];
        const index = Math.floor(i / stars.children.length * dataArray.length);
        const normalizedFrequency = dataArray[index] / 256;
        const color = new THREE.Color(
            normalizedFrequency * 0x0000ff + (1 - normalizedFrequency) * 0xffffff
        );
        star.material.color.copy(color);
    }

    const timeDelta = clock.getDelta();
    car.getWorldDirection(carForward);
    carVelocity.copy(carForward).multiplyScalar(carSpeed);
    carVelocity.z = -carSpeed;

    const intersects = groundRaycaster.intersectObject(ground);

    if (intersects.length > 0) {
        if (Math.random() < turnProbability) {
            carVelocity.applyAxisAngle(new THREE.Vector3(0, 1, 0), turnAmount * (Math.random() < 0.5 ? -1 : 1));
        }
    }

    if (car.position.z < road.position.z - roadLength / 2) {
        car.position.z = road.position.z + roadLength / 2;
        carForward.multiplyScalar(-1);
        carVelocity.copy(carForward).multiplyScalar(carSpeed);
    } else if (car.position.z > road.position.z + roadLength / 2) {
        car.position.z = road.position.z - roadLength / 2;
        carForward.multiplyScalar(-1);
        carVelocity.copy(carForward).multiplyScalar(carSpeed);
    }

    const displacement = carVelocity.clone().multiplyScalar(timeDelta);
    car.position.add(displacement);

    car.position.x = road.position.x
    car.position.y = Math.max(car.position.y, 1);

    car.getWorldDirection(carForward);
    carForward.negate();
    cameraOffset.copy(carForward).multiplyScalar(-10);
    camera.position.copy(car.position).add(cameraOffset);
    cameraLookAt.copy(car.position).add(carForward);
    camera.position.z -= 1.5;
    camera.position.y += 1;

    camera.rotation.y = car.rotation.y + Math.PI;
    
    // Raise the Y-coordinate of cameraLookAt to angle the camera up slightly
    const cameraLookUpOffset = 5; // Adjust this value to control the angle
    cameraLookAt.y += cameraLookUpOffset;
    
    camera.lookAt(cameraLookAt);

    // Position the moon ahead of the car
    const moonDistance = 100;
    const moonPosition = new THREE.Vector3().copy(car.position).addScaledVector(carForward, moonDistance);
    moonPosition.setY(50);
    moonLight.position.copy(moonPosition);
    moonGlow.position.copy(moonPosition);
    
    // Update the bloom pass
    //composer.render();
    
    renderer.render(scene, camera);
};

function animatePlaceholder() {
    requestAnimationFrame(animatePlaceholder);

    dataArray = analyser.getFrequencyData();
    const frequency = analyser.getAverageFrequency();

    for (let i = 0; i < buildings.length; i++) {
        const frequencyIndex = i / buildings.length * (maxFrequency - minFrequency) + minFrequency;
        const index = Math.floor(frequencyIndex / (maxFrequency - minFrequency) * dataArray.length);
        const normalizedFrequency = dataArray[index] / 256;
        const color = new THREE.Color().setHSL(normalizedFrequency, 1, 0.5);
        buildingColors[i].copy(color);
        buildings[i].material.color.copy(buildingColors[i]);
        buildings[i].material.emissive.copy(buildingColors[i]);

        const height = Math.max(normalizedFrequency * (frequency / 10) * maxHeight, 1);
        buildings[i].scale.setY(height);
        buildings[i].position.setY(height / 2);
    }

    for (let i = 0; i < stars.children.length; i++) {
        const star = stars.children[i];
        const index = Math.floor(i / stars.children.length * dataArray.length);
        const normalizedFrequency = dataArray[index] / 256;
        const color = new THREE.Color(
            normalizedFrequency * 0x0000ff + (1 - normalizedFrequency) * 0xffffff
        );
        star.material.color.copy(color);
    }

    const timeDelta = clock.getDelta();
    car.getWorldDirection(carForward);
    carVelocity.copy(carForward).multiplyScalar(carSpeed);
    carVelocity.z = -carSpeed;

    const intersects = groundRaycaster.intersectObject(ground);

    if (intersects.length > 0) {
        if (Math.random() < turnProbability) {
            carVelocity.applyAxisAngle(new THREE.Vector3(0, 1, 0), turnAmount * (Math.random() < 0.5 ? -1 : 1));
        }
    }

    if (car.position.z < road.position.z - roadLength / 2) {
        car.position.z = road.position.z + roadLength / 2;
        carForward.multiplyScalar(-1);
        carVelocity.copy(carForward).multiplyScalar(carSpeed);
    } else if (car.position.z > road.position.z + roadLength / 2) {
        car.position.z = road.position.z - roadLength / 2;
        carForward.multiplyScalar(-1);
        carVelocity.copy(carForward).multiplyScalar(carSpeed);
    }

    const displacement = carVelocity.clone().multiplyScalar(timeDelta);
    car.position.add(displacement);

    car.position.x = road.position.x
    car.position.y = Math.max(car.position.y, 1);

    car.getWorldDirection(carForward);
    carForward.negate();
    cameraOffset.copy(carForward).multiplyScalar(-10);
    camera.position.copy(car.position).add(cameraOffset);
    cameraLookAt.copy(car.position).add(carForward);
    camera.position.z -= 1.5;
    camera.position.y += 1;

    camera.rotation.y = car.rotation.y + Math.PI;
    
    // Raise the Y-coordinate of cameraLookAt to angle the camera up slightly
    const cameraLookUpOffset = 5; // Adjust this value to control the angle
    cameraLookAt.y += cameraLookUpOffset;
    
    camera.lookAt(cameraLookAt);

    // Position the moon ahead of the car
    const moonDistance = 100;
    const moonPosition = new THREE.Vector3().copy(car.position).addScaledVector(carForward, moonDistance);
    moonPosition.setY(50);
    moonLight.position.copy(moonPosition);
    moonGlow.position.copy(moonPosition);
    
    // Update the bloom pass
    //composer.render();
    
    renderer.render(scene, camera);
};


initHomeScreen();

