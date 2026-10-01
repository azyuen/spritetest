# Sprite Workbench

A browser-based production helper for Tokyo SHIFT and other 2D sprite workflows.

## Workspaces

- **Assets** — load, order, rename and download sprite files.
- **Sprite Design** — inspect animation frames, set a shared logical canvas and pivot, and preview playback.
- **Atlas Builder** — export Phaser-friendly PNG + JSON atlases.
- **Canvas Align** — align a generated PNG against a fixed master/reference sprite, then export it onto the exact reference canvas.
- **Reference Layout** — position and resize a transparent sprite against a fixed reference image using a reusable horizontal guide, adjustable circle and vertical proportion ruler.
- **Resize & Export** — resize complete transparent canvases, verify paired layers, and download the results as original-filename PNGs or one ZIP.

The recommended Tokyo SHIFT car-layer resize preset is **1200 px wide**. The
resizer scales the complete canvas and its artwork together without cropping,
trimming or repositioning anything, so paired paint/details layers remain
registered.

### Canvas Align workflow

1. Upload the master/reference PNG and one or more generated variants.
2. Choose the fixed reference and movable target.
3. Drag or nudge the target; adjust uniform or X/Y scale.
4. For fast geometry matching, set two corresponding points on each image (for cars, the rear and front wheel centres) and use **Match two points**.
5. Add sibling files under **Linked exports**. Paint/details pairs can therefore receive exactly the same transform.
6. Export. The reference is never baked into the output: each target is written to a transparent PNG with the exact reference canvas dimensions.

The alignment transform is centre-origin based, matching the normal Phaser `origin(0.5, 0.5)` workflow.


## Tokyo SHIFT Auto Align

Canvas Align includes a Tokyo SHIFT car workflow for standardising deployable vehicle assets:

1. Load the AE86/reference PNG plus the new car's stock body/paint and body-kit variants.
2. Select the reference and stock target.
3. Use **Auto-align stock to reference** to match visible width, horizontal centre and floor.
4. Fine-tune the stock car once, then choose **Use current as master**.
5. Link every sibling paint/body/body-kit PNG so exports inherit exactly the same transform.
6. Set rear/front wheel centres and radius using the on-canvas wheel guides.
7. Export the Tokyo SHIFT geometry JSON.

The geometry JSON records the common canvas/floor, body transform, independent wheel geometry and linked variants. The intent is that body-kit variants never require their own hidden scale/offset compensation.
