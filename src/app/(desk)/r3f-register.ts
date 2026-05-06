"use client";

// Force R3F to register Canvas with the Three.js namespace
// Turbopack strips side-effect imports, so we do it explicitly here
import { Canvas } from "@react-three/fiber";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
void Canvas;
