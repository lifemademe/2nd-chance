import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import './styles.css';

const BOARD_SIZE = 7;
const TILE_SIZE = 1;
const CAMERA_HEIGHT = 15;
const MOVE_DURATION = 0.18;
const MAX_LIVES = 2;

const root = document.querySelector('#root');
const startMenu = document.querySelector('#start-menu');
const startButton = document.querySelector('#start-button');
const gameOverMenu = document.querySelector('#game-over-menu');
const restartButton = document.querySelector('#restart-button');
const levelCounter = document.querySelector('#level-counter');
const livesCounter = document.querySelector('#lives-counter');
const tutorialPopup = document.querySelector('#tutorial-popup');
const tutorialLifePopup = document.querySelector('#tutorial-life-popup');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
const board = new THREE.Group();
const characterGrid = {
  col: Math.floor(BOARD_SIZE / 2),
  row: Math.floor(BOARD_SIZE / 2)
};
const clock = new THREE.Clock();
let moveTween = null;
let isRestarting = false;
let hasStarted = false;
let isGameOver = false;
let isTutorial = true;
let tutorialStep = 'break';
let level = 1;
let lives = MAX_LIVES;
const destroyEffects = [];
let goalHint = null;
let tutorialLockedHexagon = null;
let tutorialLockedIndicator = null;

const HEX_COLORS = [
  { name: 'yellow', value: 0xffd84d, outline: 0xfff6bf },
  { name: 'green', value: 0x25b864, outline: 0xe9fff1 },
  { name: 'blue', value: 0x4fc3f7, outline: 0xe8f8ff },
  { name: 'red', value: 0xd93f35, outline: 0xffeeee }
];

const PLAYER_START_COLOR = 0x4fc3f7;
const TUTORIAL_SWITCH_COLOR = 0x25b864;

scene.background = new THREE.Color(0x8ed7f0);

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
root.appendChild(renderer.domElement);

camera.position.set(0, CAMERA_HEIGHT, 0.001);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableRotate = false;
controls.enablePan = false;
controls.minDistance = CAMERA_HEIGHT;
controls.maxDistance = CAMERA_HEIGHT;
controls.target.set(0, 0, 0);
controls.update();

const ambient = new THREE.AmbientLight(0xffffff, 1.45);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(3, 4, 5);
scene.add(key);

const fill = new THREE.PointLight(0xffffff, 1.5, 8);
fill.position.set(-3, -1, 2);
scene.add(fill);

const water = new THREE.Mesh(
  new THREE.PlaneGeometry(36, 36),
  new THREE.MeshBasicMaterial({ color: 0x35b7d5 })
);
water.rotation.x = -Math.PI / 2;
water.position.y = -0.46;
scene.add(water);

const islandShape = new THREE.Shape();
[
  [0, -5.35],
  [1.45, -5.05],
  [3.1, -4.38],
  [4.72, -2.72],
  [5.25, -0.78],
  [4.8, 1.35],
  [3.52, 3.65],
  [1.28, 4.96],
  [-0.9, 5.35],
  [-3.0, 4.62],
  [-4.85, 2.85],
  [-5.38, 0.62],
  [-4.82, -1.72],
  [-3.25, -3.82],
  [-1.25, -5.1]
].forEach(([x, z], index) => {
  if (index === 0) {
    islandShape.moveTo(x, z);
  } else {
    islandShape.lineTo(x, z);
  }
});
islandShape.closePath();

const island = new THREE.Mesh(
  new THREE.ExtrudeGeometry(islandShape, {
    depth: 0.32,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.14,
    bevelSegments: 2
  }),
  new THREE.MeshStandardMaterial({ color: 0xd8b56f, roughness: 0.86, metalness: 0 })
);
island.rotation.x = -Math.PI / 2;
island.position.y = -0.48;
scene.add(island);

const waterRings = new THREE.Group();
const waveMaterial = new THREE.MeshBasicMaterial({
  color: 0xd8f8ff,
  transparent: true,
  opacity: 0.42
});

[6.1, 7.2, 8.4].forEach((radius) => {
  const wave = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.015, 8, 128), waveMaterial.clone());
  wave.rotation.x = -Math.PI / 2;
  wave.position.y = -0.31;
  waterRings.add(wave);
});

scene.add(waterRings);

const trees = new THREE.Group();
const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x7a4b2a, roughness: 0.85 });
const leafMaterials = [
  new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.82 }),
  new THREE.MeshStandardMaterial({ color: 0x3fb96b, roughness: 0.82 })
];
const trunkGeometry = new THREE.CylinderGeometry(0.045, 0.06, 0.32, 8);
const leafGeometry = new THREE.ConeGeometry(0.22, 0.46, 8);

function createTree(x, z, scale = 1, leafIndex = 0) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  const leaves = new THREE.Mesh(leafGeometry, leafMaterials[leafIndex % leafMaterials.length]);

  trunk.position.y = 0.02;
  leaves.position.y = 0.37;
  tree.add(trunk, leaves);
  tree.position.set(x, -0.1, z);
  tree.scale.setScalar(scale);
  tree.rotation.y = Math.random() * Math.PI;
  trees.add(tree);
}

[
  [-4.55, -1.8, 1.15],
  [-4.2, 1.45, 0.95],
  [-2.9, -3.8, 0.9],
  [-1.35, 4.45, 1.05],
  [1.8, -4.25, 1.0],
  [3.75, 2.85, 1.1],
  [4.45, -0.65, 0.92],
  [2.8, 4.0, 0.88]
].forEach(([x, z, scale], index) => createTree(x, z, scale, index));

scene.add(trees);

const darkTile = new THREE.MeshStandardMaterial({
  color: 0x8a5a35,
  roughness: 0.82,
  metalness: 0.02
});

const lightTile = new THREE.MeshStandardMaterial({
  color: 0xd9c88f,
  roughness: 0.78,
  metalness: 0.02
});

const cornerTiles = {
  '0,0': new THREE.MeshStandardMaterial({ color: 0xffd84d, roughness: 0.78, metalness: 0.02 }),
  '6,0': new THREE.MeshStandardMaterial({ color: 0x25b864, roughness: 0.78, metalness: 0.02 }),
  '0,6': new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.78, metalness: 0.02 }),
  '6,6': new THREE.MeshStandardMaterial({ color: 0xd93f35, roughness: 0.78, metalness: 0.02 })
};

const cornerGoals = {
  '0,0': 0xffd84d,
  '6,0': 0x25b864,
  '0,6': 0x4fc3f7,
  '6,6': 0xd93f35
};

const goalCorners = [
  { col: 0, row: 0, color: 0xffd84d },
  { col: 6, row: 0, color: 0x25b864 },
  { col: 0, row: 6, color: 0x4fc3f7 },
  { col: 6, row: 6, color: 0xd93f35 }
];

const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x26352f, transparent: true, opacity: 0.36 });
const tileGeometry = new THREE.BoxGeometry(TILE_SIZE, 0.16, TILE_SIZE);
const lineGeometry = new THREE.EdgesGeometry(tileGeometry);
const offset = ((BOARD_SIZE - 1) * TILE_SIZE) / 2;

for (let row = 0; row < BOARD_SIZE; row += 1) {
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const tileMaterial = cornerTiles[`${col},${row}`] || ((row + col) % 2 === 0 ? lightTile : darkTile);
    const tile = new THREE.Mesh(tileGeometry, tileMaterial);
    tile.position.set(col * TILE_SIZE - offset, 0, row * TILE_SIZE - offset);
    board.add(tile);

    const outline = new THREE.LineSegments(lineGeometry, edgeMaterial);
    outline.position.copy(tile.position);
    board.add(outline);
  }
}

const base = new THREE.Mesh(
  new THREE.BoxGeometry(BOARD_SIZE * TILE_SIZE + 0.22, 0.2, BOARD_SIZE * TILE_SIZE + 0.22),
  new THREE.MeshStandardMaterial({ color: 0x3f5249, roughness: 0.9 })
);
base.position.y = -0.2;
scene.add(base);

scene.add(board);

const character = new THREE.Mesh(
  new THREE.CylinderGeometry(0.34, 0.34, 0.36, 6),
  new THREE.MeshStandardMaterial({
    color: PLAYER_START_COLOR,
    roughness: 0.42,
    metalness: 0.08
  })
);
character.position.set(0, 0.26, 0);
character.rotation.y = Math.PI * 1.5;
scene.add(character);

const characterOutline = new THREE.LineSegments(
  new THREE.EdgesGeometry(character.geometry),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72 })
);
character.add(characterOutline);

const characterIndicator = new THREE.Mesh(
  new THREE.CircleGeometry(0.18, 48),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide
  })
);
characterIndicator.rotation.x = -Math.PI / 2;
characterIndicator.position.y = 0.19;
character.add(characterIndicator);

function createSwapHexagon(color, outlineColor, gridPosition) {
  const hexagon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.36, 6),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      metalness: 0.08
    })
  );

  hexagon.position.set(
    gridPosition.col * TILE_SIZE - offset,
    0.26,
    gridPosition.row * TILE_SIZE - offset
  );
  hexagon.rotation.y = Math.PI * 1.5;

  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(hexagon.geometry),
    new THREE.LineBasicMaterial({ color: outlineColor, transparent: true, opacity: 0.72 })
  );
  hexagon.add(outline);
  scene.add(hexagon);

  return {
    mesh: hexagon,
    grid: gridPosition
  };
}

let swapHexagons = [];

const swapIndicatorMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: false,
  opacity: 1,
  side: THREE.DoubleSide
});
const swapIndicators = [];
const tutorialLockedIndicatorMaterial = new THREE.MeshBasicMaterial({
  color: 0xd93f35,
  transparent: false,
  opacity: 1,
  side: THREE.DoubleSide
});

const gui = new GUI({ title: 'Scene' });
gui.addFolder('Character');
gui.addFolder('Camera');
gui.close();

function placeCharacterOnGrid() {
  character.position.x = characterGrid.col * TILE_SIZE - offset;
  character.position.z = characterGrid.row * TILE_SIZE - offset;
}

function isCenterTile(col, row) {
  return col === Math.floor(BOARD_SIZE / 2) && row === Math.floor(BOARD_SIZE / 2);
}

function getCornerGoalColor(col, row) {
  return cornerGoals[`${col},${row}`] || null;
}

function isCornerTile(col, row) {
  return getCornerGoalColor(col, row) !== null;
}

function getRandomHexColor() {
  return HEX_COLORS[Math.floor(Math.random() * HEX_COLORS.length)];
}

function populateHexagons() {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (isCenterTile(col, row) || isCornerTile(col, row)) continue;

      const color = getRandomHexColor();
      swapHexagons.push(createSwapHexagon(color.value, color.outline, { col, row }));
    }
  }
}

function populateTutorialHexagons() {
  swapHexagons.push(createSwapHexagon(PLAYER_START_COLOR, 0xe8f8ff, { col: 3, row: 2 }));
  swapHexagons.push(createSwapHexagon(TUTORIAL_SWITCH_COLOR, 0xe9fff1, { col: 4, row: 2 }));
}

function disposeHexagon(hexagon) {
  scene.remove(hexagon.mesh);
  hexagon.mesh.children.forEach((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
  hexagon.mesh.geometry.dispose();
  hexagon.mesh.material.dispose();
}

function clearHexagons() {
  swapHexagons.forEach(disposeHexagon);
  swapHexagons = [];
}

function resetBoard() {
  isRestarting = false;
  isGameOver = false;
  moveTween = null;
  hideSwapIndicators();
  clearHexagons();
  characterGrid.col = Math.floor(BOARD_SIZE / 2);
  characterGrid.row = Math.floor(BOARD_SIZE / 2);
  character.material.color.setHex(PLAYER_START_COLOR);
  lives = MAX_LIVES;
  updateLivesCounter();
  placeCharacterOnGrid();
  updateGoalHint();
  updateSwapIndicators();
}

function startTutorial() {
  isTutorial = true;
  tutorialStep = 'break';
  tutorialLockedHexagon = null;
  hideTutorialLockedIndicator();
  tutorialLifePopup.classList.add('hidden');
  resetBoard();
  clearHexagons();
  populateTutorialHexagons();
  updateTutorialPopup();
  updateGoalHint();
  updateSwapIndicators();
}

function startNormalGame() {
  isTutorial = false;
  tutorialLockedHexagon = null;
  hideTutorialLockedIndicator();
  tutorialPopup.classList.add('hidden');
  tutorialLifePopup.classList.add('hidden');
  resetBoard();
  populateHexagons();
  updateGoalHint();
  updateSwapIndicators();
}

function updateLevelCounter() {
  levelCounter.textContent = `Level ${level}`;
}

function updateLivesCounter() {
  livesCounter.textContent = `Lives ${lives}`;
}

function updateTutorialPopup() {
  if (!isTutorial) {
    tutorialPopup.classList.add('hidden');
    return;
  }

  const messages = {
    break: 'Press W to break the matching blue hex.',
    swap: 'Press D to swap colors with the green hex.',
    goal: 'Move to the pulsing green corner to begin the game.'
  };

  tutorialPopup.textContent = messages[tutorialStep];
  tutorialPopup.classList.toggle('hidden', !hasStarted);
}

function advanceTutorialStep(nextStep) {
  if (!isTutorial) return;

  tutorialStep = nextStep;
  updateTutorialPopup();
}

function isTutorialMoveAllowed(code) {
  if (!isTutorial) return true;
  if (tutorialStep === 'break') return code === 'KeyW';
  if (tutorialStep === 'swap') return code === 'KeyD';
  return true;
}

function getGridPosition(col, row) {
  return new THREE.Vector3(col * TILE_SIZE - offset, character.position.y, row * TILE_SIZE - offset);
}

function createRoundedRectRingGeometry(width, depth, border, radius) {
  const roundedRect = (shape, x, y, rectWidth, rectDepth, cornerRadius) => {
    shape.moveTo(x + cornerRadius, y);
    shape.lineTo(x + rectWidth - cornerRadius, y);
    shape.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + cornerRadius);
    shape.lineTo(x + rectWidth, y + rectDepth - cornerRadius);
    shape.quadraticCurveTo(x + rectWidth, y + rectDepth, x + rectWidth - cornerRadius, y + rectDepth);
    shape.lineTo(x + cornerRadius, y + rectDepth);
    shape.quadraticCurveTo(x, y + rectDepth, x, y + rectDepth - cornerRadius);
    shape.lineTo(x, y + cornerRadius);
    shape.quadraticCurveTo(x, y, x + cornerRadius, y);
  };

  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const innerWidth = width - border * 2;
  const innerDepth = depth - border * 2;
  const outerRadius = Math.min(radius, halfWidth, halfDepth);
  const innerRadius = Math.max(outerRadius - border * 0.45, 0.01);
  const shape = new THREE.Shape();
  const hole = new THREE.Path();

  roundedRect(shape, -halfWidth, -halfDepth, width, depth, outerRadius);
  roundedRect(hole, -halfWidth + border, -halfDepth + border, innerWidth, innerDepth, innerRadius);
  shape.holes.push(hole);

  return new THREE.ShapeGeometry(shape, 8);
}

function hideSwapIndicators() {
  swapIndicators.forEach((indicator) => {
    indicator.visible = false;
  });
}

function getSwapIndicator(index) {
  if (swapIndicators[index]) return swapIndicators[index];

  const indicator = new THREE.Mesh(new THREE.BufferGeometry(), swapIndicatorMaterial);
  indicator.rotation.x = -Math.PI / 2;
  indicator.position.y = 0.18;
  indicator.visible = false;
  swapIndicators.push(indicator);
  scene.add(indicator);

  return indicator;
}

function getTutorialLockedIndicator() {
  if (tutorialLockedIndicator) return tutorialLockedIndicator;

  tutorialLockedIndicator = new THREE.Mesh(
    createRoundedRectRingGeometry(TILE_SIZE + 0.18, TILE_SIZE + 0.18, 0.08, 0.18),
    tutorialLockedIndicatorMaterial
  );
  tutorialLockedIndicator.rotation.x = -Math.PI / 2;
  tutorialLockedIndicator.position.y = 0.19;
  tutorialLockedIndicator.visible = false;
  scene.add(tutorialLockedIndicator);

  return tutorialLockedIndicator;
}

function hideTutorialLockedIndicator() {
  if (tutorialLockedIndicator) tutorialLockedIndicator.visible = false;
}

function showTutorialLockedIndicator(hexagon) {
  const indicator = getTutorialLockedIndicator();
  indicator.position.x = hexagon.grid.col * TILE_SIZE - offset;
  indicator.position.z = hexagon.grid.row * TILE_SIZE - offset;
  indicator.visible = true;
}

function updateSwapIndicators() {
  if (isRestarting) {
    hideSwapIndicators();
    return;
  }

  const nearbySameColorHexagons = swapHexagons.filter((hexagon) => {
    const distance =
      Math.abs(characterGrid.col - hexagon.grid.col) + Math.abs(characterGrid.row - hexagon.grid.row);

    return distance === 1 && character.material.color.equals(hexagon.mesh.material.color);
  });

  if (nearbySameColorHexagons.length === 0) {
    hideSwapIndicators();
    return;
  }

  hideSwapIndicators();

  nearbySameColorHexagons.forEach((hexagon, index) => {
    const indicator = getSwapIndicator(index);
    const minCol = Math.min(characterGrid.col, hexagon.grid.col);
    const maxCol = Math.max(characterGrid.col, hexagon.grid.col);
    const minRow = Math.min(characterGrid.row, hexagon.grid.row);
    const maxRow = Math.max(characterGrid.row, hexagon.grid.row);
    const width = (maxCol - minCol + 1) * TILE_SIZE + 0.18;
    const depth = (maxRow - minRow + 1) * TILE_SIZE + 0.18;
    const centerCol = (minCol + maxCol) / 2;
    const centerRow = (minRow + maxRow) / 2;

    indicator.geometry.dispose();
    indicator.geometry = createRoundedRectRingGeometry(width, depth, 0.08, 0.18);
    indicator.position.x = centerCol * TILE_SIZE - offset;
    indicator.position.z = centerRow * TILE_SIZE - offset;
    indicator.visible = true;
  });
}

function moveCharacterByTile(code) {
  if (moveTween || isRestarting || isGameOver) return;
  if (!isTutorialMoveAllowed(code)) return;

  let nextCol = characterGrid.col;
  let nextRow = characterGrid.row;

  if (code === 'KeyW') nextRow -= 1;
  if (code === 'KeyS') nextRow += 1;
  if (code === 'KeyA') nextCol -= 1;
  if (code === 'KeyD') nextCol += 1;

  nextCol = THREE.MathUtils.clamp(nextCol, 0, BOARD_SIZE - 1);
  nextRow = THREE.MathUtils.clamp(nextRow, 0, BOARD_SIZE - 1);

  if (nextCol === characterGrid.col && nextRow === characterGrid.row) return;

  const targetHexagon = swapHexagons.find((hexagon) => nextCol === hexagon.grid.col && nextRow === hexagon.grid.row);

  if (targetHexagon) {
    if (isTutorial && targetHexagon === tutorialLockedHexagon) return;

    if (!character.material.color.equals(targetHexagon.mesh.material.color)) {
      swapHexagonColors(targetHexagon);
      updateSwapIndicators();
      checkWinCondition();
      return;
    } else {
      moveTween = createMoveTween(nextCol, nextRow, () => destroyHexagon(targetHexagon));
    }
  } else {
    moveTween = createMoveTween(nextCol, nextRow);
  }
}

function createMoveTween(nextCol, nextRow, onComplete = null) {
  characterGrid.col = nextCol;
  characterGrid.row = nextRow;
  hideSwapIndicators();

  return {
    elapsed: 0,
    from: character.position.clone(),
    to: getGridPosition(nextCol, nextRow),
    onComplete
  };
}

function swapHexagonColors(hexagon) {
  const characterColor = character.material.color.clone();
  character.material.color.copy(hexagon.mesh.material.color);
  hexagon.mesh.material.color.copy(characterColor);
  updateGoalHint();
  loseLife();

  if (isTutorial && tutorialStep === 'swap') {
    tutorialLockedHexagon = hexagon;
    showTutorialLockedIndicator(hexagon);
    tutorialLifePopup.classList.remove('hidden');
    advanceTutorialStep('goal');
  }
}

function destroyHexagon(hexagon) {
  createDestroyEffect(hexagon.mesh.position);
  disposeHexagon(hexagon);
  swapHexagons = swapHexagons.filter((current) => current !== hexagon);
  gainLife();

  if (isTutorial && tutorialStep === 'break') {
    advanceTutorialStep('swap');
  }
}

function loseLife() {
  lives = Math.max(lives - 1, 0);
  updateLivesCounter();

  if (lives === 0) {
    showGameOver();
  }
}

function gainLife() {
  lives = Math.min(lives + 1, MAX_LIVES);
  updateLivesCounter();
}

function showGameOver() {
  isGameOver = true;
  hasStarted = false;
  moveTween = null;
  hideSwapIndicators();
  hideGoalHint();
  gameOverMenu.classList.remove('hidden');
}

function restartAfterGameOver() {
  level = 1;
  updateLevelCounter();
  gameOverMenu.classList.add('hidden');
  hasStarted = true;
  startTutorial();
}

function checkWinCondition() {
  const goalColor = getCornerGoalColor(characterGrid.col, characterGrid.row);
  if (!goalColor || character.material.color.getHex() !== goalColor || isRestarting) return;

  isRestarting = true;
  hideSwapIndicators();
  hideGoalHint();

  if (isTutorial) {
    tutorialPopup.classList.add('hidden');
    window.setTimeout(startNormalGame, 500);
    return;
  }

  level += 1;
  updateLevelCounter();
  window.setTimeout(startNormalGame, 500);
}

function createGoalHint() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.46, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    })
  );
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.36, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    })
  );

  ring.rotation.x = -Math.PI / 2;
  glow.rotation.x = -Math.PI / 2;
  group.position.y = 0.22;
  group.add(glow, ring);
  scene.add(group);

  return {
    group,
    ring,
    glow,
    elapsed: 0
  };
}

function hideGoalHint() {
  if (goalHint) goalHint.group.visible = false;
}

function updateGoalHint() {
  if (!goalHint) goalHint = createGoalHint();

  const playerColor = character.material.color.getHex();
  const matchingGoal = goalCorners.find((corner) => corner.color === playerColor);

  if (!matchingGoal) {
    hideGoalHint();
    return;
  }

  goalHint.group.position.x = matchingGoal.col * TILE_SIZE - offset;
  goalHint.group.position.z = matchingGoal.row * TILE_SIZE - offset;
  goalHint.ring.material.color.setHex(playerColor);
  goalHint.glow.material.color.setHex(playerColor);
  goalHint.group.visible = true;
}

function updateGoalHintEffect(delta) {
  if (!goalHint || !goalHint.group.visible) return;

  goalHint.elapsed += delta;
  const pulse = (Math.sin(goalHint.elapsed * 5) + 1) / 2;
  const scale = 1 + pulse * 0.28;

  goalHint.ring.scale.setScalar(scale);
  goalHint.glow.scale.setScalar(1.05 + pulse * 0.45);
  goalHint.ring.material.opacity = 0.58 + pulse * 0.38;
  goalHint.glow.material.opacity = 0.1 + pulse * 0.18;
}

function updateWaterEffect(delta) {
  waterRings.rotation.y += delta * 0.08;

  waterRings.children.forEach((wave, index) => {
    const pulse = (Math.sin(clock.elapsedTime * 1.4 + index * 1.7) + 1) / 2;
    wave.material.opacity = 0.18 + pulse * 0.24;
    wave.scale.setScalar(1 + pulse * 0.018);
  });
}

function createDestroyEffect(position) {
  const effect = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.4, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    })
  );
  const flash = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    })
  );

  ring.rotation.x = -Math.PI / 2;
  flash.rotation.x = -Math.PI / 2;
  effect.position.copy(position);
  effect.position.y = 0.32;
  effect.add(ring, flash);
  scene.add(effect);

  destroyEffects.push({
    group: effect,
    ring,
    flash,
    elapsed: 0,
    duration: 0.34
  });
}

function updateDestroyEffects(delta) {
  for (let index = destroyEffects.length - 1; index >= 0; index -= 1) {
    const effect = destroyEffects[index];
    effect.elapsed += delta;

    const progress = Math.min(effect.elapsed / effect.duration, 1);
    const eased = 1 - (1 - progress) ** 3;

    effect.ring.scale.setScalar(1 + eased * 1.45);
    effect.flash.scale.setScalar(1 + eased * 2.1);
    effect.ring.material.opacity = 0.9 * (1 - progress);
    effect.flash.material.opacity = 0.35 * (1 - progress);

    if (progress === 1) {
      scene.remove(effect.group);
      effect.ring.geometry.dispose();
      effect.ring.material.dispose();
      effect.flash.geometry.dispose();
      effect.flash.material.dispose();
      destroyEffects.splice(index, 1);
    }
  }
}

function updateCharacterMove(delta) {
  if (!moveTween) return;

  moveTween.elapsed += delta;
  const progress = Math.min(moveTween.elapsed / MOVE_DURATION, 1);
  const eased = 1 - (1 - progress) ** 3;

  character.position.lerpVectors(moveTween.from, moveTween.to, eased);

  if (progress === 1) {
    character.position.copy(moveTween.to);
    const onComplete = moveTween.onComplete;
    moveTween = null;
    if (onComplete) onComplete();
    checkWinCondition();
    updateSwapIndicators();
  }
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  updateCharacterMove(delta);
  updateDestroyEffects(delta);
  updateGoalHintEffect(delta);
  updateWaterEffect(delta);
  controls.update();
  renderer.render(scene, camera);
}

updateLevelCounter();
updateLivesCounter();
startTutorial();
window.addEventListener('resize', resize);
startButton.addEventListener('click', () => {
  hasStarted = true;
  startMenu.classList.add('hidden');
  updateTutorialPopup();
});
restartButton.addEventListener('click', restartAfterGameOver);
window.addEventListener('keydown', (event) => {
  if (!hasStarted || isGameOver) return;
  if (event.repeat || !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) return;
  moveCharacterByTile(event.code);
});
animate();
