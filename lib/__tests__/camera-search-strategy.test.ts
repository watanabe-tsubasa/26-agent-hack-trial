import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCameraSearchStrategy } from "../agent/camera-search-strategy";

test("kanda-office uses time_window_frames", () => {
  assert.equal(resolveCameraSearchStrategy("kanda-office"), "time_window_frames");
});

test("aeon-mall-kanda uses fixed_generated_images", () => {
  assert.equal(
    resolveCameraSearchStrategy("aeon-mall-kanda"),
    "fixed_generated_images"
  );
});

test("unknown facility falls back to fixed_generated_images", () => {
  assert.equal(resolveCameraSearchStrategy("nonexistent"), "fixed_generated_images");
  assert.equal(resolveCameraSearchStrategy(null), "fixed_generated_images");
  assert.equal(resolveCameraSearchStrategy(undefined), "fixed_generated_images");
});
