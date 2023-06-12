//import * as THREE from 'three';
//import { EffectComposer, RenderPass, UnrealBloomPass } from 'postprocessing';

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.151.3/build/three.module.js';

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

const init = () => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
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

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(0, 20, 0);
    scene.add(pointLight);

    const listener = new THREE.AudioListener();
    camera.add(listener);

    audio = new THREE.Audio(listener);

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('src/Evolution v3.wav', (buffer) => {
        audio.setBuffer(buffer);
        audio.setLoop(true);
        audio.setVolume(0.5);

        document.getElementById('playButton').addEventListener('click', () => {
            audio.play();
            animate();
            document.getElementById('playButton').style.display = 'none';
        });

    });

    analyser = new THREE.AudioAnalyser(audio, 64);
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    // Create a road plane
    const roadGeometry = new THREE.PlaneGeometry(roadWidth, roadLength);
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x404040 }); // Dark gray color for the road
    road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2; // Rotate the road plane to make it horizontal
    road.position.y = 0.01; // Raise the road slightly above the ground
    scene.add(road);
    
    const carGeometry = new THREE.BoxGeometry(1, 1, 2);
    const carMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    car = new THREE.Mesh(carGeometry, carMaterial);
    car.position.y = 1;
    car.position.x = (Math.random() - 0.5) * 50;
    car.position.z = 0;
    scene.add(car);

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
    
//    const bloomStrength = 1;
//    const bloomRadius = 0.1;
//    const bloomThreshold = 0.3;
//    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), bloomStrength, bloomRadius, bloomThreshold);
//    composer.addPass(new RenderPass(scene, camera));
//    composer.addPass(bloomPass);
    
};

const animate = () => {
    requestAnimationFrame(animate);

    dataArray = analyser.getFrequencyData();
    const frequency = analyser.getAverageFrequency();

    const minFrequency = 100;
    const maxFrequency = 8000;

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

    car.position.x = road.position.x;

    car.position.y = Math.max(car.position.y, 1);

    car.getWorldDirection(carForward);
    carForward.negate();
    cameraOffset.copy(carForward).multiplyScalar(-10);
    camera.position.copy(car.position).add(cameraOffset);
    cameraLookAt.copy(car.position).add(carForward);
    
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


init();
