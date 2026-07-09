# Project Design Document

---

Project Name: Rose Window Digital Exhibition System

Version: V1.0

Author: 沃涵

Document Version: 1.0

Last Update: 2026-07

---

## 1. Project Overview

### 1.1 Background

Rose windows are one of the representative artistic elements in architectural history. Traditional rose windows usually combine radial geometry, colored glass and light to create a unique visual experience.

This project does not reproduce traditional religious rose windows. Instead, it redesigns the rose window into a contemporary artistic form composed of abstract colored glass blocks while preserving its iconic radial geometry.

The system aims to build an interactive digital exhibition that allows users to freely explore the artwork and understand its artistic value through spatial interaction rather than traditional web pages.

---

### 1.2 Project Goal

Develop a browser-based interactive 3D exhibition using WebGL.

Users can directly access the exhibition through a web browser without downloading any software.

The system combines:

- First-person exploration
- Interactive light particle animation
- Modern digital exhibition space
- Cultural information presentation

to provide an immersive digital cultural experience.

---

### 1.3 Design Philosophy

The project is built around three core principles.

#### Freedom

Users are free to move throughout the exhibition space.

There is no fixed viewing order.

There are no mandatory tasks or guided routes.

Users discover information through exploration.

---

#### Authenticity

The system presents verified cultural and artistic information.

The exhibition focuses on the artistic, architectural and historical significance of rose windows rather than religious storytelling.

---

#### Immersion

Instead of displaying information immediately, the system gradually reveals content according to the user's behavior.

The exhibition encourages observation before reading.

The interaction itself becomes part of the exhibition experience.

---

## 2. Design Concept

The artwork is represented by an Interactive Light Point System (ILPS). The points are permanently bound to the rose window structure and respond only through controlled positional displacement. They are not generated or destroyed during runtime.

### 2.1 Exhibition Theme

The exhibition presents a single contemporary rose window artwork.

The artwork removes all religious figures and symbolic narratives.

Instead, the glass is reconstructed using abstract geometric color compositions inspired by modern art.

The exhibition emphasizes:

- Geometry
- Color
- Light
- Space
- Visual rhythm

rather than religious expression.

---

### 2.2 Core Interaction Concept

The central artwork is composed of a Interactive Light Point System.

The particles represent light rather than physical matter.

From a distance, the particles form a compact and stable rose window.

As the visitor approaches, the particles gradually disperse while preserving the overall silhouette.

This behavior symbolizes that the artwork is responding to the visitor's presence.

The particle movement is gentle and continuous rather than explosive or chaotic.

---

### 2.3 Cultural Exhibition

When visitors approach the artwork closely enough, several information nodes appear around the rose window.

Each node represents one aspect of the artwork.

For example:

- History
- Color
- Architecture
- Craftsmanship
- Light

Users may freely select any node to read additional information.

The system does not require information to be viewed in any particular order.

---

## 3. User Experience

The intended experience follows a gradual exploration process.

```
Enter Exhibition

↓

Observe

↓

Approach

↓

Light Particles Respond

↓

Information Nodes Appear

↓

Read Cultural Content

↓

Continue Exploring

↓

Leave

↓

System Returns to Initial State
```

The interaction should feel calm, natural and continuous.

No abrupt transitions should occur.

---

## 4. Visual Style

The exhibition space follows a minimalist contemporary aesthetic.

### Environment

- Dark exhibition hall
- Quiet atmosphere
- Minimal architectural decoration
- Single exhibition object
- Soft environmental lighting

The environment exists only to support the artwork.

---

### Artwork

The rose window remains the visual center throughout the entire experience.

No visual element should compete with it.

The Interactive Light Point System should appear elegant, stable and lightweight.

Particle behavior should resemble floating light rather than physical debris.

---

### User Interface

The interface follows a modern glassmorphism style.

Characteristics include:

- Semi-transparent panels
- Rounded corners
- Soft shadows
- Slight glow
- Minimal visual hierarchy

The interface should integrate naturally into the exhibition rather than appearing as a traditional webpage.

---

## 5. System Scope

### Included Features

The first version (V1.0) includes:

- Browser-based WebGL application
- First-person movement
- Modern exhibition space
- Single rose window artwork
- Light particle interaction
- Distance-based particle response
- Information nodes
- Cultural information panels

---

### Excluded Features

The following features are not part of Version 1.0:

- Multiplayer interaction
- VR support
- Physics simulation
- Combat mechanics
- Collection mechanics
- Character system
- Animation storytelling
- Religious narrative
- Multiple exhibition objects

These features may be considered in future versions.

---

## 6. Design Principles

The following principles must always be respected during development.

### Principle 1

The rose window is always the visual focus.

No other object should dominate the viewer's attention.

---

### Principle 2

Every interaction should support the exhibition experience.

Interactions exist to reveal cultural information rather than create gameplay.

---

### Principle 3

Animations should be smooth and restrained.

Avoid exaggerated visual effects.

---

### Principle 4

The exhibition emphasizes exploration rather than instruction.

Users should feel that they are discovering information naturally.

---

### Principle 5

The system should remain lightweight enough to run smoothly inside a browser.

Performance should never be sacrificed for unnecessary visual complexity.

---

## 7. Future Extension

The current project focuses on establishing a complete interaction loop.

If development time allows, future versions may include:

- Optional Physical Rose Window Mesh Rendering
- Advanced lighting effects
- Higher density particle simulation
- Audio interaction
- Multiple exhibition themes
- Additional artworks

These enhancements are optional and should not affect the completion of Version 1.0.

---

## 8. Success Criteria

The project is considered successful if users can:

- Enter the exhibition through a browser.
- Freely explore the exhibition.
- Observe the rose window.
- Trigger particle interaction by approaching.
- Discover information nodes.
- Read cultural content.
- Leave the exhibition while the system returns smoothly to its initial state.

The overall experience should communicate a calm, elegant and modern digital exhibition rather than a traditional video game.

---
