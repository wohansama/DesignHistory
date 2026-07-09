# Interaction Behavior Specification

---

Project Name: Rose Window Digital Exhibition System

Version: V1.0

Document Version: 1.0

Last Update: 2026-07

---

## 1. Purpose

This document defines how users interact with the exhibition and how the system should respond.

It focuses entirely on observable behaviors rather than implementation details.

Every interaction described here should produce a smooth, continuous and predictable user experience.

---

## 2. Interaction Flow

The exhibition follows a simple interaction loop.

```

Enter Exhibition

↓

Observe

↓

Approach Artwork

↓

Light Point Response

↓

Information Discovery

↓

Read Content

↓

Continue Exploring

↓

Leave Artwork

↓

System Recovery

```

The user may repeat this loop at any time.

No forced interaction sequence exists.

---

## 3. Interaction States

The system consists of four interaction states.

| State | Name | Description |
|--------|------|-------------|
| S0 | Observation | User observes the artwork from a distance |
| S1 | Approach | User approaches the artwork |
| S2 | Exploration | User explores nearby information |
| S3 | Reading | User reads detailed cultural information |

---

## 4. State S0 — Observation

### Trigger

Player enters the exhibition.

or

Player is farther than the interaction distance.

---

### User Experience

The visitor immediately notices a single rose window suspended in the exhibition hall.

The artwork appears calm and stable.

The user is encouraged to approach naturally.

---

### System Behaviour

The Interactive Light Point System remains compact.

Light points stay close to their original positions.

A subtle idle animation is active.

No information nodes are visible.

No information panels are displayed.

---

### Exit Condition

Player enters the interaction radius.

---

## 5. State S1 — Approach

### Trigger

Player enters the interaction radius.

Recommended distance:

3m ~ 8m

---

### User Experience

The artwork begins responding to the visitor's presence.

The response should feel gradual rather than immediate.

The visitor should perceive that the artwork is reacting naturally.

---

### System Behaviour

The Interactive Light Point System begins positional displacement.

The displacement gradually increases as the player approaches.

Only nearby light points are affected.

The overall silhouette of the rose window must remain recognizable.

The artwork should never appear destroyed or randomly scattered.

No information nodes are displayed.

---

### Exit Conditions

Player moves closer than the exploration distance.

or

Player leaves the interaction radius.

---

## 6. State S2 — Exploration

### Trigger

Player enters the exploration radius.

Recommended distance:

Less than 3 meters.

---

### User Experience

The visitor has reached the ideal viewing distance.

The system now encourages cultural exploration.

The artwork remains the primary visual focus.

---

### System Behaviour

Light point displacement reaches its maximum allowed range.

The overall rose window silhouette remains visible.

Five information nodes appear sequentially.

Nodes should fade in one after another.

Node positions remain fixed after appearing.

Information nodes should never block the center of the artwork.

---

### User Actions

The user may:

- Walk around the artwork.
- Observe the artwork.
- Select any information node.
- Leave the artwork.

No interaction order is required.

---

### Exit Conditions

User selects a node.

or

Player leaves the exploration radius.

---

## 7. State S3 — Reading

### Trigger

User selects one information node.

---

### User Experience

The selected topic expands into a modern information panel.

The user remains free to close the panel at any time.

The artwork should remain visible whenever possible.

---

### System Behaviour

The selected information panel opens.

Only one information panel may remain open.

Other information nodes remain visible.

The player may continue moving while the panel is open.

Closing the panel returns the system to Exploration State.

---

### Exit Conditions

User closes the information panel.

or

Player leaves the interaction radius.

---

## 8. Recovery Behaviour

### Trigger

Player leaves the interaction radius.

---

### System Behaviour

Information panels close automatically.

Information nodes disappear in reverse order.

Light points gradually return to their original positions.

The idle animation resumes.

The system returns to Observation State.

Recovery should occur smoothly without abrupt transitions.

---

## 9. Continuous Behaviours

The following behaviours remain active throughout the entire application.

### Camera

The player can always look around freely.

---

### Movement

The player can always move freely inside the exhibition.

---

### Artwork

The rose window always remains at the center of the exhibition.

---

### Lighting

Lighting changes should be subtle.

No sudden brightness changes should occur.

---

## 10. Interaction Constraints

The following behaviours are prohibited.

- Instant state switching
- Abrupt particle movement
- Random point explosions
- Camera locking
- Forced reading sequence
- Automatic information pop-ups
- UI elements covering the artwork
- Gameplay mechanics unrelated to cultural exhibition

---

## 11. Intended Emotional Experience

The exhibition should communicate the following progression.

Curiosity

↓

Approach

↓

Discovery

↓

Understanding

↓

Reflection

The interaction should feel calm, intuitive and exhibition-oriented rather than game-oriented.

---
