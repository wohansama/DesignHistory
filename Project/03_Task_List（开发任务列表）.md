# Development Task List

---

Project Name: Rose Window Digital Exhibition System

Version: V1.0

Document Version: 1.0

Last Update: 2026-07

---

## 1. Development Strategy

The project follows an incremental development strategy.

Each stage must be independently executable before proceeding to the next stage.

No feature should be developed if the previous stage has not passed its acceptance criteria.

Development Priority:

Core Interaction

↓

Visual Presentation

↓

User Interface

↓

Performance Optimization

↓

Optional Enhancements

---

## 2. Milestone Overview

| Milestone | Description |
|------------|-------------|
| M1 | Project Framework |
| M2 | Scene Construction |
| M3 | Player Controller |
| M4 | Interactive Light Point System |
| M5 | Information Node System |
| M6 | Information Panel |
| M7 | Optimization |
| M8 | Optional Enhancement |

---

## 3. Milestone M1 - Project Framework

### Task 1.1

Create project structure.

Deliverables

- Web application starts successfully
- Rendering loop created
- Basic folder structure established

Acceptance

Browser opens successfully without errors.

---

### Task 1.2

Initialize renderer.

Deliverables

- WebGL Renderer
- Camera
- Scene
- Resize handling

Acceptance

Window resizing functions correctly.

---

## 4. Milestone M2 - Scene Construction

### Task 2.1

Create exhibition hall.

Deliverables

- Floor
- Ceiling
- Four walls

Acceptance

Player can move freely inside the hall.

---

### Task 2.2

Create lighting.

Deliverables

- Ambient Light
- Main Directional Light
- HDR Environment (optional)

Acceptance

Scene lighting is stable.

---

## 5. Milestone M3 - Player Controller

### Task 3.1

Implement first-person controller.

Deliverables

- WASD movement
- Mouse look

Acceptance

Player movement is smooth.

---

### Task 3.2

Clamp movement.

Acceptance

Player cannot leave the exhibition space.

---

## 6. Milestone M4 - Interactive Light Point System

### Task 4.1

Load rose window resource.

Preferred Source

GLB

Fallback

Orthographic PNG

Acceptance

Artwork data loads successfully.

---

### Task 4.2

Generate Interactive Light Point System.

Deliverables

- Light points generated
- Original positions stored

Acceptance

Rose window silhouette is recognizable.

---

### Task 4.3

Implement idle animation.

Acceptance

Light points exhibit subtle breathing motion.

---

### Task 4.4

Implement distance detection.

Acceptance

Player distance updates every frame.

---

### Task 4.5

Implement point offset behaviour.

Acceptance

Approaching the artwork causes nearby light points to smoothly move outward while preserving the overall rose window silhouette.

---

### Task 4.6

Implement recovery behaviour.

Acceptance

Light points return smoothly after the player leaves.

---

## 7. Milestone M5 - Information Node System

### Task 5.1

Create five information nodes.

Acceptance

Nodes are positioned around the artwork.

---

### Task 5.2

Implement sequential appearance.

Acceptance

Nodes fade in one after another.

---

### Task 5.3

Implement click detection.

Acceptance

Each node can be selected.

---

## 8. Milestone M6 - Information Panel

### Task 6.1

Create glassmorphism UI.

Acceptance

Panel appears correctly.

---

### Task 6.2

Load information.

Acceptance

Correct content is displayed.

---

### Task 6.3

Close interaction.

Acceptance

Panel closes correctly.

---

## 9. Milestone M7 - Optimization

### Task 7.1

Reduce unnecessary draw calls.

---

### Task 7.2

Optimize point rendering.

---

### Task 7.3

Maintain target frame rate.

Acceptance

Desktop maintains approximately 60 FPS.

---

## 10. Milestone M8 - Optional Enhancement

The following tasks are optional and should only begin after all previous milestones have passed.

Optional Tasks

- Physical rose window mesh
- PBR material
- Bloom
- SSAO
- HDR environment refinement
- Improved shaders
- Audio ambience

Failure to complete these tasks does not affect Version 1.0 completion.

---

## 11. Completion Criteria

Version 1.0 is complete when all required milestones from M1 to M7 have passed acceptance.

Optional enhancements belong to Version 1.x and should not delay project delivery.

---
