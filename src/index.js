import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/build/three.module.js';
import { OrbitControls } from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/loaders/GLTFLoader.js';
import { GUI } from 'https://threejsfundamentals.org/threejs/../3rdparty/dat.gui.module.js';

var ambientLight,
    analyser,
    audio,
    backButton,
    camera,
    canvasContainer,
    car,
    dataArray,
    frequency,
    ground,
    listener,
    loader,
    play,
    pointLight,
    renderer,
    road,
    roadGeometry,
    roadMaterial,
    scene,
    stars;

var cameraOffset = new THREE.Vector3();
var cameraLookAt = new THREE.Vector3();
var carForward = new THREE.Vector3();
var carSpeed = 25;
var carVelocity = new THREE.Vector3();
var clock = new THREE.Clock();
var currentSong = '';
var geometry;
var groundRaycaster = new THREE.Raycaster();
var laserColors = [];
var laserGroup = new THREE.Object3D();
var laserLength = 10000;
var laserOffset = 20;
var lasers = [];
var laserWidth = 0.1;
var maxFrequency = 10000;
var maxLaserHeight = 50;
var minFrequency = 0;
var roadLength = 300;
var roadWidth = 10;
var songName = 'How I Should of Been.wav';
var spaceBetweenLasers = 5;
var speedFactor = 100;
var traveledDistance = 0;
var turnAmount = Math.PI / 4;
var turnProbability = 0.1;

var lasersPerSide = Math.floor(roadLength / (laserWidth + spaceBetweenLasers));
var numLasers = lasersPerSide * 2;

async function init() {
    return new Promise((resolve, reject) => {
        try {
            ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
            geometry = new THREE.BoxGeometry(1, 1, 1);
            listener = new THREE.AudioListener();
            audio = new THREE.Audio(listener);
            loader = new GLTFLoader();
            pointLight = new THREE.PointLight(0xffffff, 1, 100);
            renderer = new THREE.WebGLRenderer({ antialias: true });
            roadMaterial = new THREE.MeshStandardMaterial({ color: 0xfffff, transparent: true, opacity: 0.1 });
            scene = new THREE.Scene();
            stars = new THREE.Group();

            analyser = new THREE.AudioAnalyser(audio, 64);
            roadGeometry = new THREE.PlaneGeometry(roadWidth, roadLength);

            dataArray = new Uint8Array(analyser.frequencyBinCount);
            road = new THREE.Mesh(roadGeometry, roadMaterial);

            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            canvasContainer = document.getElementById('canvasContainer');

            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setClearColor(0x000000);
            renderer.useLegacyLights = true;
            document.body.appendChild(renderer.domElement);

            for (let i = 0; i < numLasers; i++) {
                var laserPosition = new THREE.Vector3();
                var laserHeight = Math.random() * maxLaserHeight + 1;
                var laserColor = new THREE.Color().setHSL(i / numLasers, 1, 0.5);
                var laserMaterial = new THREE.MeshPhongMaterial({ color: laserColor, emissive: laserColor, emissiveIntensity: 1.0 });
                var side = i % 2 === 0 ? -1 : 1;
                var rotationAngle = Math.random() * Math.PI * 2;

                var laser = new THREE.Mesh(geometry, laserMaterial);
                var halfHeight = laserHeight / 2;
                laserPosition.x = side * (roadWidth / 2 + laserOffset);
                laserPosition.z = ((i % lasersPerSide) * (laserWidth + spaceBetweenLasers)) - roadLength / 2;
                laser.position.copy(laserPosition);
                laser.position.y = laserHeight / 2;
                var newPosition = new THREE.Vector3(laser.position.x, laser.position.y - halfHeight, laser.position.z);
                laser.position.copy(newPosition);

                
                laser.scale.set(laserWidth, laserHeight, laserWidth);
                laser.rotateX(rotationAngle);

                lasers.push(laser);
                laserColors.push(laserColor);

                laserGroup.add(laser);
            }

            for (let i = 0; i < 1000; i++) {
                let starGeometry = new THREE.SphereGeometry(1, 8, 8);
                let starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

                let star = new THREE.Mesh(starGeometry, starMaterial);

                star.position.x = Math.random() * 2000 - 1000;
                star.position.z = Math.random() * 2000 - 1000;
                if (Math.abs(star.position.z) < 200) {
                    star.position.y = Math.random() * 500 + 500;
                } else {
                    star.position.y = Math.random() * 1000;
                }

                stars.add(star);
            }

            renderer.setSize(window.innerWidth, window.innerHeight);
            canvasContainer.appendChild(renderer.domElement);
            window.addEventListener('resize', onWindowResize, false);

            camera.add(listener);

            scene.add(ambientLight);
            scene.add(pointLight);
            scene.add(laserGroup);
            scene.add(road);
            scene.add(stars);

            loader.load(
                "car.glb",
                function (gltf) {
                    car = gltf.scene;
                    car.children[0].rotation.z = Math.PI;
                    scene.add(car);
                    car.position.z = road.position.z - roadLength / 2;
                    carForward.multiplyScalar(-1);
                    carVelocity.copy(carForward).multiplyScalar(carSpeed);
                    resolve();
                },
                function (xhr) {
                    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                },
                function (error) {
                    console.log('An error happened', error);
                    reject(error);
                }
            );

            camera.position.set(0, 0, 5);
            camera.position.y = 5;
            pointLight.position.set(0, 20, 0);
            road.position.y = 0.01;
            road.rotation.x = -Math.PI / 2;
        } catch (error) {
            console.error("Initialization error:", error);
            reject(error);
        }
    });
}

function animate() {
    var timeDelta = clock.getDelta();
    var displacement;

    requestAnimationFrame(animate);
    traveledDistance += carVelocity.length() * clock.getDelta();
    if (traveledDistance >= 275) {
        traveledDistance = 0;
        laserGroup.visible = !laserGroup.visible;
    }
    dataArray = analyser.getFrequencyData();
    frequency = analyser.getAverageFrequency();

    for (let i = 0; i < lasers.length; i++) {
        const frequencyIndex = i / lasers.length * (maxFrequency - minFrequency) + minFrequency;
        const index = Math.floor(frequencyIndex / (maxFrequency - minFrequency) * dataArray.length);
        const normalizedFrequency = dataArray[index] / 256;
        const rotationX = normalizedFrequency * Math.PI;

        if (rotationX == 0) {
            lasers[i].visible = false;
        } else {
            lasers[i].visible = true;
            lasers[i].rotation.x = rotationX;
        }

        lasers[i].scale.set(0.1, 0.1, laserLength);
        var color = new THREE.Color().setHSL(normalizedFrequency, 1, 0.5);
        laserColors[i] = color; // Correctly assign color
        lasers[i].material.color.copy(laserColors[i]);
        lasers[i].material.emissive.copy(laserColors[i]);
        lasers[i].position.y = 0;
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

    car.getWorldDirection(carForward);
    carVelocity.copy(carForward).multiplyScalar(carSpeed);
    carVelocity.z = -carSpeed;

    if (car.position.z < road.position.z - roadLength / 2) {
        car.position.z = road.position.z + roadLength / 2;
        carForward.multiplyScalar(-1);
        carVelocity.copy(carForward).multiplyScalar(carSpeed);
    } else if (car.position.z > road.position.z + roadLength / 2) {
        car.position.z = road.position.z - roadLength / 2;
        carForward.multiplyScalar(-1);
        carVelocity.copy(carForward).multiplyScalar(carSpeed);
    }

    displacement = carVelocity.clone().multiplyScalar(timeDelta);
    car.position.add(displacement);
    car.position.x = road.position.x;
    car.position.y = Math.max(car.position.y, 1);
    car.getWorldDirection(carForward);
    carForward.negate();
    cameraOffset.copy(carForward).multiplyScalar(-10);
    camera.position.copy(car.position).add(cameraOffset);
    cameraLookAt.copy(car.position).add(carForward);
    camera.position.z -= 1.5;
    camera.position.y += 1;
    camera.rotation.y = car.rotation.y + Math.PI;
    const cameraLookUpOffset = 5;
    cameraLookAt.y += cameraLookUpOffset;
    camera.lookAt(cameraLookAt);

    renderer.render(scene, camera);
}

async function destroyScene() {
    laserGroup.remove.apply(laserGroup, laserGroup.children);
    await Promise.all(laserGroup.children.map(async (laser) => {
        if (laser.geometry) { laser.geometry.dispose(); }
        if (laser.material) {
            if (Array.isArray(laser.material)) {
                await Promise.all(laser.material.map(async (material) => {
                    material.dispose();
                    if (material.map) { material.map.dispose(); }
                }));
            } else {
                laser.material.dispose();
                if (laser.material.map) { laser.material.map.dispose(); }
            }
        }
    }));
    scene.remove.apply(scene, scene.children.filter(child => child instanceof THREE.Light || child instanceof THREE.Camera));
    lasers = [];
    laserColors = [];
    const canvasContainer = document.getElementById('canvasContainer');
    if (canvasContainer && canvasContainer.firstChild) {
        canvasContainer.removeChild(canvasContainer.firstChild);
    }
    renderer.dispose();
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

function hideElement(id) { document.getElementById(id).style.display = 'none'; }

function initHomeScreen() {
    play = document.getElementById('play');
    backButton = document.getElementById('backButton');

    play.addEventListener('click', function () {
        init().then(() => {
            playSong(songName);
            hideElement('songButtons');
            showElement('canvasContainer');
        }).catch(error => {
            console.error("Error during initialization:", error);
        });
    });
    backButton.addEventListener('click', goBackToMainScreen);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function playSong(filename) {
    const audioLoader = new THREE.AudioLoader();
    currentSong = filename;
    audioLoader.load(filename, (buffer) => {
        if (audio.isPlaying) { audio.stop(); }
        audio.setBuffer(buffer);
        audio.setLoop(true);
        audio.setVolume(0.5);
        audio.play();
        animate();
    }, undefined, (error) => {
        console.error("Error loading audio file:", error);
    });
    document.getElementById('songButtons').style.display = 'none';
    document.getElementById('backButton').style.display = 'block';
}

function showElement(id) { document.getElementById(id).style.display = 'block'; }

document.addEventListener('DOMContentLoaded', (event) => {
    initHomeScreen();
});
