# Sprite Workbench

A browser-based production helper for Tokyo SHIFT and other 2D sprite workflows.

## Workspaces

- **Assets** — load, order, rename and download sprite files.
- **Sprite Design** — inspect animation frames, set a shared logical canvas and pivot, and preview playback.
- **Atlas Builder** — export Phaser-friendly PNG + JSON atlases.
- **Canvas Align** — align a generated PNG against a fixed master/reference sprite, then export it onto the exact reference canvas.

### Canvas Align workflow

1. Upload the master/reference PNG and one or more generated variants.
2. Choose the fixed reference and movable target.
3. Drag or nudge the target; adjust uniform or X/Y scale.
4. For fast geometry matching, set two corresponding points on each image (for cars, the rear and front wheel centres) and use **Match two points**.
5. Add sibling files under **Linked exports**. Paint/details pairs can therefore receive exactly the same transform.
6. Export. The reference is never baked into the output: each target is written to a transparent PNG with the exact reference canvas dimensions.

The alignment transform is centre-origin based, matching the normal Phaser `origin(0.5, 0.5)` workflow.
