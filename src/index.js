import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/build/three.module.js';
import { OrbitControls } from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/loaders/GLTFLoader.js';
import { GUI } from 'https://threejsfundamentals.org/threejs/../3rdparty/dat.gui.module.js';

var analyser,
    audio,
    camera,
    canvasContainer,
    target,
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
var targetForward = new THREE.Vector3();
var targetSpeed = 25;
var targetVelocity = new THREE.Vector3();
var clock = new THREE.Clock();
var currentSong = '';
var geometry;
var groundRaycaster = new THREE.Raycaster();
var laserColors = [];
var laserGroup = new THREE.Object3D();
var laserLength = 1000;
var laserOffset = 20;
var lasers = [];
var laserWidth = 0.5;
var maxFrequency = 10000;
var maxLaserHeight = 50;
var minFrequency = 0;
var roadLength = 255;
var roadWidth = 25;
var songName = 'Sun Goes Down.wav';
var spaceBetweenLasers = 15;
var speedFactor = 100;
var traveledDistance = 0;
var turnProbability = 0.1;
var trackLength = roadLength * 2;

var stayOnRoad = true;
var nitrus = false;

var lasersPerSide = Math.floor(trackLength / (laserWidth + spaceBetweenLasers));
var numLasers = lasersPerSide * 2;

var ambientLight,
    directionalLight,
    pointLight;

var over = 1;

var start = true;

var numStars = 1000;

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
            scene = new THREE.Scene();
            stars = new THREE.Group();

            analyser = new THREE.AudioAnalyser(audio, 64);
            roadGeometry = new THREE.PlaneGeometry(roadWidth, roadLength);

            dataArray = new Uint8Array(analyser.frequencyBinCount);
            road = new THREE.Mesh(roadGeometry, createTrippyMaterial());
            road.visible = false;

            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            canvasContainer = document.getElementById('canvasContainer');

            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setClearColor(0x000000);
            renderer.useLegacyLights = true;
            document.body.appendChild(renderer.domElement);

            // Create and add ambient light with increased intensity
            ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Increase intensity
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
                laserPosition.z = ((i % lasersPerSide) * (laserWidth + spaceBetweenLasers)) - trackLength / 2;
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
            
            laserGroup.visible = false;

            for (let i = 0; i < numStars; i++) {
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
                star.position.y *= over;
                over *= -1;

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
            portalMesh.position.set(0, 2, 3 * (-roadLength / 2) - 15);
            portalMesh.rotation.y = Math.PI; // Rotate to face the target
            //portalMesh.visible = false;
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
            portalMesh2.rotation.y = Math.PI; // Rotate to face the target
            scene.add(portalMesh2);
            portalMesh2.visible = false;

            // Add light to enhance portal glow effect
            const portalLight2 = new THREE.PointLight(0x00ff00, 1, 20);
            portalLight2.position.set(0, 3, -roadLength / 2 - 15);
            scene.add(portalLight2);

            // Initialize the target
            target = new THREE.Object3D();
            scene.add(target);
            target.position.z = road.position.z - roadLength / 2;
            targetForward.multiplyScalar(-1);
            targetVelocity.copy(targetForward).multiplyScalar(targetSpeed);

            resolve();
        } catch (error) {
            console.error("Initialization error:", error);
            reject(error);
        }
    });
}

function createTrippyMaterial() {
    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        uniform float time;
        varying vec2 vUv;
        void main() {
            vec2 uv = vUv;
            uv.y += time * 0.1;
            vec3 color = vec3(0.5 + 0.5 * sin(time + uv.x * 10.0), 0.5 + 0.5 * sin(time + uv.y * 10.0), 0.5 + 0.5 * sin(time + uv.x * 5.0 + uv.y * 5.0));
            gl_FragColor = vec4(color, 1.0);
        }
    `;

    return new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.DoubleSide,
        transparent: true
    });
}

function animate() {
    var timeDelta = clock.getDelta();
    var displacement;

    requestAnimationFrame(animate);
    traveledDistance += targetVelocity.length() * clock.getDelta();
    if (traveledDistance >= 275) {
        traveledDistance = 0;
    }
    dataArray = analyser.getFrequencyData();
    frequency = analyser.getAverageFrequency();

    for (let i = 0; i < lasers.length; i++) {
        const frequencyIndex = i / lasers.length * (maxFrequency - minFrequency) + minFrequency;
        const index = Math.floor(frequencyIndex / (maxFrequency - minFrequency) * dataArray.length);
        const normalizedFrequency = dataArray[index] / 256;
        const rotationX = normalizedFrequency * Math.PI;

        if (rotationX == 0) {
            laserGroup.visible = true;
            lasers[i].rotation.x = rotationX;
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

    target.getWorldDirection(targetForward);
    targetVelocity.copy(targetForward).multiplyScalar(targetSpeed);
    targetVelocity.z = -targetSpeed;

    // Start and End
    if (target.position.z < road.position.z - roadLength / 2 && stayOnRoad) {
        if (start) {
            //laserGroup.visible = false; 
        } else {
            laserGroup.visible = true;
        }
        start = !start;
        stayOnRoad = false;
        console.log("Begin");
        target.position.z = road.position.z + roadLength / 2;
        targetForward.multiplyScalar(-1);
        targetVelocity.copy(targetForward).multiplyScalar(targetSpeed);

        // Portal 1 - Engage Nitrus
    } else if (target.position.z < road.position.z - roadLength / 2 && !nitrus) {
        //laserGroup.visible = false;
        nitrus = true;
        nitrusEffects.forEach(effect => effect.visible = true);
        console.log("Engage Nitrus");

    } else if (target.position.z < (road.position.z - roadLength / 2) * 3 - 15 && !stayOnRoad) {
        console.log("Return");
        target.position.z = road.position.z + roadLength / 2;
        targetForward.multiplyScalar(-1);
        targetVelocity.copy(targetForward).multiplyScalar(targetSpeed);

        // In Between
    } else if (target.position.z > road.position.z + roadLength / 2) {
        console.log("idk tbh");
        targetForward.multiplyScalar(-1);
        targetVelocity.copy(targetForward).multiplyScalar(targetSpeed);
    }

    displacement = targetVelocity.clone().multiplyScalar(timeDelta);
    target.position.add(displacement);
    target.position.x = road.position.x;
    target.position.y = Math.max(target.position.y, 1);
    target.getWorldDirection(targetForward);
    targetForward.negate();
    cameraOffset.copy(targetForward).multiplyScalar(-10);
    camera.position.copy(target.position).add(cameraOffset);
    cameraLookAt.copy(target.position).add(targetForward);
    camera.position.z -= 1.5;
    camera.position.y += 1;
    camera.rotation.y = target.rotation.y + Math.PI;
    const cameraLookUpOffset = 5;
    cameraLookAt.y += cameraLookUpOffset;
    camera.lookAt(cameraLookAt);

    road.material.uniforms.time.value += timeDelta;

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

function hideElement(id) { document.getElementById(id).style.display = 'none'; }

function initHomeScreen() {
    play = document.getElementById('play');

    play.addEventListener('click', function () {
        init().then(() => {
            playSong(songName);
            hideElement('songButtons');
            showElement('canvasContainer');
        }).catch(error => {
            console.error("Error during initialization:", error);
        });
    });
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
}

function showElement(id) { document.getElementById(id).style.display = 'block'; }

document.addEventListener('DOMContentLoaded', (event) => {
    initHomeScreen();
});
