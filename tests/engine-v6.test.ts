import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HZ,
  configFor,
  createSimulation,
  makeScene,
  sceneShapes,
  stageForScore,
  validateReplay,
} from '../lib/engine-v6.ts';

test('difficulty stages advance every 5,000 points with a clear speed increase', () => {
  assert.deepEqual(
    [0, 4_999, 5_000, 10_000].map((score) => {
      const stage = stageForScore(score);
      return [stage.level, stage.name, stage.targetSpeed];
    }),
    [
      [1, 'GATEWAY', 225],
      [1, 'GATEWAY', 225],
      [2, 'CONDUIT', 285],
      [3, 'SWITCHBACK', 345],
    ],
  );
});

test('the opening course mixes angled gates, moving hazards, turrets, and tokens', () => {
  const scenes = Array.from({length: 8}, (_, ordinal) => makeScene(ordinal * 500, ordinal, 0, ordinal, 12345));
  assert.deepEqual(scenes.map((scene) => scene.type), ['gate', 'turret', 'sliders', 'orbit', 'gate', 'pendulum', 'pinwheel', 'gem']);
  assert.ok(scenes.filter((scene) => scene.type === 'gate').some((scene) => Math.abs(scene.angle) > 0.1));
  assert.ok(scenes.some((scene) => scene.token));

  const moving = scenes.find((scene) => scene.type === 'orbit')!;
  assert.notDeepEqual(sceneShapes(moving, 600, 0), sceneShapes(moving, 600, 0.5));
});

test('tracking turrets charge and fire reproducible two-shot bursts', () => {
  const simulation = createSimulation(configFor('2026-09-21'));
  const point = {x: 180, y: 540};
  for (let tick = 1; tick <= HZ * 4; tick++) simulation.step(point, point, tick);

  assert.ok(simulation.shots.length >= 2);
  assert.ok(simulation.shots.some((shot) => shot.fired));
  assert.ok(simulation.shots.every((shot) => shot.target.x === point.x && shot.target.y === point.y));
});

test('live score and server replay agree for a clean one-second run', () => {
  const config = configFor('2026-09-21');
  const points = Array.from({length: HZ + 1}, () => ({x: 180, y: 540}));
  const replay = validateReplay(config, points, 'lift');
  assert.equal(replay.valid, true);
  assert.equal(replay.score, 100);
});
