# Technical Specification

---

Project Name: Rose Window Digital Exhibition System

Version: V1.0

Document Version: 1.0

Last Update: 2026-07

---

## 1. System Architecture

### 1.1 Overview

The application is a browser-based interactive 3D exhibition built on WebGL.

The system consists of the following modules:

```

Application

├── Scene

├── Player Controller

├── Light Point System

├── Information Node System

├── Information Panel System

└── Resource Manager

```

Each module should be independent to simplify future maintenance and feature expansion.

---

## 2. Scene Specification

### 2.1 Exhibition Space

The exhibition contains only one artwork.

Scene Components:

- Floor
- Ceiling
- Four surrounding walls
- Ambient lighting
- One central rose window
- Information nodes

No unnecessary decorative objects should be added.

---

### 2.2 Coordinate System

The center of the rose window should be located at the world origin.

Example:

Position

X = 0

Y = 2.0

Z = 0

The player initially faces the artwork.

---

## 3. Player Specification

### 3.1 Camera

Perspective Camera

Field of View:

60°

Near Plane:

0.1

Far Plane:

100

---

### 3.2 Movement

Movement Mode:

First Person

Supported Input:

- W
- A
- S
- D
- Mouse Look

Optional:

Shift Sprint

Not Required:

- Jump
- Crouch
- Attack
- Inventory

---

### 3.3 Initial Position

Recommended:

Distance from artwork:

10 meters

Player should immediately see the complete rose window after entering the scene.

---

## 4. Light Point Count

### 4.1 Source Data

The Interactive Light Point System should be generated from one of the following sources.

Priority 1

Rose Window Model (.glb)

Priority 2

Orthographic Front View PNG

The implementation should prefer the model whenever available.

The PNG serves as a fallback solution.

---

### 4.2 Overview

The rose window is represented by a Light Point Count.

The Point system itself is the primary visual representation of the artwork.

The first version does not require an underlying physical glass model.

---

### 4.3 Particle Properties

Each particle should contain at least:

- Initial Position
- Current Position
- Color
- Size
- Movement Offset

Optional:

- Random Seed
- Animation Phase

---

### 4.4 Point Count

Recommended:

30,000 ~ 80,000 Points

The implementation should allow future adjustment.

Point count should be configurable.

---

### 4.5 Point Color

Point colors should be sampled from the original rose window artwork.

Random colors are not allowed.

The overall appearance should preserve the visual composition of the original design.

---

### 4.6 Idle Animation

Default State:

Point remain close to their initial positions.

Allowed animation:

- Small breathing movement
- Slight floating motion

Maximum offset should remain visually negligible.

---

## 5. Interaction Parameter

### Interaction Parameters

The following parameters control all runtime interactions.

Parameter A

Player Distance

Controls:

• Light point displacement

• Information node visibility

• Interaction intensity

---

Parameter B

Selected Information Node

Controls:

• Information panel

---

Parameter C (Optional)

Camera View Direction

Reserved for future interaction.

---

## 6. Distance Interaction

The displacement magnitude should be a smooth monotonic function of player distance.

Sudden discontinuities are not allowed.

The interaction should remain continuous throughout the player's movement.

### 6.1 Trigger

The system continuously measures the distance between:

Player Camera

↓

Rose Window Center

---

### 6.2 Continuous Distance Mapping

The interaction is entirely parameter-driven.

The only primary interaction parameter is the distance between the player camera and the center of the rose window.

The system shall continuously evaluate this distance every frame.

All interaction intensity shall be mapped from this parameter.

No discrete state transition shall be used for light point movement.

---

### 6.3 Point Offset Behaviour

When entering Dispersion State:

Particles gradually move away from their initial positions.

Movement characteristics:

- Smooth
- Continuous
- Stable

The overall rose window silhouette must remain recognizable.

Particles must not scatter randomly.

Particles must not completely separate from the artwork.

Recommended maximum displacement:

10%~15%

of the artwork radius.

---

### 6.4 Return Mapping Behaviour

When the player moves away from the artwork,

the light point displacement shall continuously decrease,

eventually returning every point to its original position.

---

## 7. Information Node System

### 7.1 Trigger

Information Nodes appear only after entering Exploration State.

Nodes should fade in sequentially.

---

### 7.2 Node Count

Recommended:

Five nodes.

Suggested topics:

- History
- Color
- Architecture
- Craftsmanship
- Light

The actual content may be modified later.

---

### 7.3 Node Placement

Nodes should surround the artwork.

Nodes should never block the center of the rose window.

The player must always have an unobstructed view of the artwork.

---

### 7.4 Node Interaction

Mouse Click

↓

Open Information Panel

---

## 8. Information Panel

Each panel contains:

- Title
- Image
- Description
- Close Button

The panel should use a modern glass-style interface.

Only one information panel may remain open at a time.

---

## 9. Animation Specification

All transitions should use smooth interpolation.

Recommended duration:

Particle Dispersion:

1.5 ~ 2.0 s

Particle Recovery:

2.0 s

Node Fade In:

0.3 s

Panel Open:

0.2 s

Abrupt transitions are prohibited.

---

## 10. Resource Management

Recommended Assets

- Rose Window Model (Optional Future)
- Rose Window Front PNG
- Particle Texture
- HDR Environment
- UI Icons
- Information Images

All assets should be loaded asynchronously.

---

## 11. Performance Target

Target Frame Rate

Desktop:

60 FPS

Minimum Acceptable:

30 FPS

The application should prioritize stable performance over excessive visual effects.

---

## 12. Constraints

The following behaviors are prohibited.

- Random particle explosion
- Fish school simulation
- Physics-based particle collision
- Gameplay mechanics
- Weapon system
- Enemy AI
- Complex particle destruction
- Particle behavior that destroys the rose window silhouette
- Information nodes blocking the artwork
- Strong flashing visual effects

---

## 13. Future Extension

Possible future upgrades include:

- Physical glass model beneath particles
- Advanced PBR rendering
- Dynamic global illumination
- GPU Compute Particle Simulation
- Audio interaction
- VR mode

These features are outside the scope of Version 1.0.

---

## 14. Configuration

All configurable values should be stored in a centralized configuration object.

Example:

Interaction Radius

Maximum Offset

Particle Size

Animation Speed

Node Count

Fade Duration

---

## 15. Event Flow

Application Start

↓

Load Assets

↓

Initialize Scene

↓

Generate Light Points

↓

Player Spawn

↓

Start Update Loop

↓

Distance Detection

↓

Interaction Update

↓

Rendering

---

## 16 Optional Rendering Pipeline

Rose Window

↓

Generate Light Points

↓

Vertex Shader

↓

Position Offset

↓

Fragment Shader

↓

Screen

---
