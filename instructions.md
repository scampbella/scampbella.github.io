# Color Scheme Guide: High-Contrast Dark "Ethereal Precision"

This guide outlines the color logic and token values for the high-contrast dark mode of the Scott Campbell portfolio. The aesthetic is defined by pure black surfaces, high-contrast white typography, and vibrant light blue accents.

## 1. Core Palette
*   **Background (Surface)**: `#000000` (Pure Black). Use this for the primary page background and the lowest container levels.
*   **Primary Text (On-Surface)**: `#FFFFFF` (Pure White). Use for all primary headings, body text, and navigation links.
*   **Accent Color (Primary)**: `#7DD3FC` (Sky Blue / Light Blue). Use for interactive elements, metadata, active states, and small structural accents.
*   **Secondary/Muted Text**: `#A1A1AA` (Zinc-400 / Cool Gray). Use for less prominent information like timestamps or secondary labels.
*   **Borders/Dividers**: `#FFFFFF` with `10% - 20%` opacity. Use for subtle structural separation without breaking the high-contrast feel.

## 2. Component Logic
*   **Navigation Bar**:
    *   Background: Transparent or `#000000` with glassmorphism (backdrop-blur).
    *   Links: `#FFFFFF` (White).
    *   Active State: `#7DD3FC` (Light Blue) with a bottom border or bold weight.
*   **Blog/Game Cards**:
    *   Background: `#0e0e0e` or `#131313` (Slightly elevated black/dark gray).
    *   Border: `1px solid rgba(255, 255, 255, 0.1)`.
    *   Hover State: Subtle elevation or a light blue glow/border.
*   **Buttons**:
    *   Primary: Background `#7DD3FC`, Text `#000000`.
    *   Ghost/Outline: Border `#7DD3FC`, Text `#7DD3FC`.
*   **Meta Information (Dates, Read Time)**:
    *   Text: `#7DD3FC`.

## 3. Typography & Contrast
*   **Headings**: Bold, heavy weights in `#FFFFFF`.
*   **Body**: Standard weight in `#FFFFFF` (ensure high readability against `#000000`).
*   **Links**: `#7DD3FC` with underline on hover.

## 4. Visual Effects
*   **Glassmorphism**: Use `backdrop-blur-xl` with a dark overlay (`rgba(0,0,0,0.8)`) for sticky headers or modals.
*   **Shadows**: Avoid traditional drop shadows. Use subtle "glows" using the accent color with very low opacity (e.g., `shadow-[0_0_30px_rgba(125,211,252,0.05)]`).