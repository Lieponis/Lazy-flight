import "./previewboot"; // KEEP THIS FIRST: it must run before any other code reads the save box (src/previewboot.ts)
// Entry of /galaxy-map-preview.html (prototype G2). Developer page: online only, never part of the offline game.
import { mountGalaxyPreview } from "./render/galaxy/preview";

const root = document.getElementById("app");
if (root) mountGalaxyPreview(root);
