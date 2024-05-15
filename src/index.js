import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/build/three.module.js';
import { OrbitControls } from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/loaders/GLTFLoader.js';
import { GUI } from 'https://threejsfundamentals.org/threejs/../3rdparty/dat.gui.module.js';

var analyser,
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
var songName = 'Day 134 - REM.wav';
var spaceBetweenLasers = 5;
var speedFactor = 100;
var traveledDistance = 0;
var turnAmount = Math.PI / 4;
var turnProbability = 0.1;

var stayOnRoad = true;
var nitrus = false;

var lasersPerSide = Math.floor(roadLength / (laserWidth + spaceBetweenLasers));
var numLasers = lasersPerSide * 2;

var headlights = [],
    taillights = [];

var ambientLight,
    directionalLight,
    pointLight;

    
// Nitrus
var nitrusEffects = [];

// Portal
var portalGeometry, portalMaterial, portalMesh;

// Portal 2
var portalGeometry2, portalMaterial2, portalMesh2;

async function init() {
    return new Promise((resolve, reject) => {
        try {
            
            geometry = new THREE.BoxGeometry(1, 1, 1);
            listener = new THREE.AudioListener();
            audio = new THREE.Audio(listener);
            loader = new GLTFLoader();
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
           
            // Create and add ambient light with increased intensity
            ambientLight = new THREE.AmbientLight(0xffffff, 1.0);  // Increase intensity
            scene.add(ambientLight);

            // Add a directional light for better illumination
            directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(0, 10, 10).normalize();
            scene.add(directionalLight);

            // Add a point light for additional illumination
            pointLight = new THREE.PointLight(0xffffff, 1, 50);
            pointLight.position.set(0, 5, 5);
            scene.add(pointLight);          
            

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
            scene.add(laserGroup);
            scene.add(road);
            scene.add(stars);
            
            // Portal
            portalGeometry = new THREE.RingGeometry(2, 3, 64);
            const portalVertexShader = `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `;
            const portalFragmentShader = `
                uniform float time;
                varying vec2 vUv;
                void main() {
                    float color = 0.5 + 0.5 * sin(time + vUv.x * 10.0);
                    gl_FragColor = vec4(color, 1.0 - color, color, 1.0);
                }
            `;
            portalMaterial = new THREE.ShaderMaterial({
                uniforms: { time: { value: 0.0 } },
                vertexShader: portalVertexShader,
                fragmentShader: portalFragmentShader,
                side: THREE.DoubleSide,
                transparent: true
            });
            portalMesh = new THREE.Mesh(portalGeometry, portalMaterial);
            portalMesh.position.set(0, 2, 3*(-roadLength / 2) - 15);
            portalMesh.rotation.y = Math.PI;  // Rotate to face the car
            scene.add(portalMesh);

            // Add light to enhance portal glow effect
            const portalLight = new THREE.PointLight(0x00ff00, 1, 20);
            portalLight.position.set(0, 3, -roadLength / 2 + 5);
            scene.add(portalLight);
            
            // Portal 2
            portalGeometry2 = new THREE.RingGeometry(2, 3, 64);
            const portalVertexShader2 = `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `;
            const portalFragmentShader2 = `
                uniform float time;
                varying vec2 vUv;
                void main() {
                    float color = 0.5 + 0.5 * sin(time + vUv.x * 10.0);
                    gl_FragColor = vec4(color, 1.0 - color, color, 1.0);
                }
            `;
            portalMaterial2 = new THREE.ShaderMaterial({
                uniforms: { time: { value: 0.0 } },
                vertexShader: portalVertexShader2,
                fragmentShader: portalFragmentShader2,
                side: THREE.DoubleSide,
                transparent: true
            });
            portalMesh2 = new THREE.Mesh(portalGeometry2, portalMaterial2);
            portalMesh2.position.set(0, 2, -roadLength / 2 - 15);
            portalMesh2.rotation.y = Math.PI;  // Rotate to face the car
            scene.add(portalMesh2);

            // Add light to enhance portal glow effect
            const portalLight2 = new THREE.PointLight(0x00ff00, 1, 20);
            portalLight2.position.set(0, 3, -roadLength / 2 - 15);
            scene.add(portalLight2);
            
            loader.load(
                "car.glb",
                function (gltf) {
                    car = gltf.scene;
                    car.children[0].rotation.z = Math.PI;
                    scene.add(car);
                    car.position.z = road.position.z - roadLength / 2;
                    carForward.multiplyScalar(-1);
                    carVelocity.copy(carForward).multiplyScalar(carSpeed);
                    
                    // Initialize nitrous effect
                    const nitrusVertexShader = `
                        varying vec2 vUv;
                        void main() {
                            vUv = uv;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `;
                    const nitrusFragmentShader = `
                        uniform float time;
                        varying vec2 vUv;
                        void main() {
                            float color = 0.5 + 0.5 * sin(time + vUv.y * 10.0);
                            gl_FragColor = vec4(0.0, color, 1.0 - color, 1.0);
                        }
                    `;
                    const nitrusMaterial = new THREE.ShaderMaterial({
                        uniforms: { time: { value: 0.0 } },
                        vertexShader: nitrusVertexShader,
                        fragmentShader: nitrusFragmentShader,
                        side: THREE.DoubleSide,
                        transparent: true
                    });

                    for (let i = 0; i < 3; i++) {
                        const scale = 0.5 + i * 0.5;
                        const nitrusGeometry = new THREE.ConeGeometry(0.75 * scale, 2 * scale, 32);
                        const nitrusEffect = new THREE.Mesh(nitrusGeometry, nitrusMaterial);
                        nitrusEffect.rotation.x = Math.PI; // Point it backwards
                        nitrusEffect.position.set(0, -0.5 - i, -2 - i); // Position at the back of the car
                        nitrusEffect.visible = false; // Start hidden
                        car.add(nitrusEffect);
                        nitrusEffects.push(nitrusEffect);
                    }
                    
                    // Add headlights
                    for (let i = -1; i <= 1; i += 2) {
                        const headlight = new THREE.SpotLight(0xffffff, 1);
                        headlight.position.set(i * 0.5, 0.5, 1);
                        headlight.angle = Math.PI / 6;
                        headlight.penumbra = 0.2;
                        headlight.castShadow = true;
                        car.add(headlight);
                        headlights.push(headlight);
                    }

                    // Add taillights
                    for (let i = -1; i <= 1; i += 2) {
                        const taillight = new THREE.PointLight(0xff0000, 1, 10);
                        taillight.position.set(i * 0.5, 0.5, -1.5);
                        car.add(taillight);
                        taillights.push(taillight);
                    }
                    
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
    
    portalMesh.rotation.z += 0.01;
    portalMesh2.rotation.z += 0.01;
    portalMaterial.uniforms.time.value += timeDelta;
    portalMaterial2.uniforms.time.value += timeDelta;

    car.getWorldDirection(carForward);
    carVelocity.copy(carForward).multiplyScalar(carSpeed);
    carVelocity.z = -carSpeed;

    // Start and End
    if (car.position.z < road.position.z - roadLength / 2 && stayOnRoad) {
        stayOnRoad = false;
        console.log("Begin");
        car.position.z = road.position.z + roadLength / 2;
        carForward.multiplyScalar(-1);
        carVelocity.copy(carForward).multiplyScalar(carSpeed);
        
    // Portal 1 - Engage Nitrus
    } else if (car.position.z < road.position.z - roadLength / 2 && !nitrus) {
        nitrus = true;
        nitrusEffects.forEach(effect => effect.visible = true);
        console.log("Engage Nitrus");
        
    } else if (car.position.z < (road.position.z - roadLength /2)*3 - 15 && !stayOnRoad) {
        console.log("Return");
        car.position.z = road.position.z + roadLength / 2;
        carForward.multiplyScalar(-1);
        carVelocity.copy(carForward).multiplyScalar(carSpeed);       
        
    // In Between
    } else if (car.position.z > road.position.z + roadLength / 2) {
        console.log("idk tbh");
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
