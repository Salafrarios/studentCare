# Student Care

> An AI-powered assistive system using Computer Vision to support accessibility and student well-being in higher education.

## 1. Project Overview

Student Care is a technological solution that leverages Computer Vision and Artificial Intelligence to assist universities in identifying and responding to situations in which neurodivergent students may require support, particularly during potential crisis events.

The system enables students to register in advance and voluntarily provide relevant accessibility information and support preferences. During authorized academic activities, such as classroom sessions, the system monitors predefined behavioral indicators and identifies patterns that may suggest a need for assistance.

When a potential event is detected, Student Care sends an alert to the university's Accessibility Coordination Office (COAcessi), enabling the responsible team to assess the situation and provide appropriate support.

Student Care is not intended to diagnose medical conditions, confirm crises automatically, or replace qualified accessibility professionals. Its purpose is to function as an assistive tool that supports early awareness and human-centered intervention.

---

## 2. Problem Statement

Neurodivergent university students may experience challenges in academic environments, including sensory overload, emotional dysregulation, and situations that affect their participation and well-being.

In many educational institutions, identifying these situations depends primarily on the observation of professors, colleagues, or accessibility professionals. This may lead to:

- Delays in identifying situations requiring assistance;
- Difficulties locating students in need of support;
- Limited access to previously authorized support information;
- Delayed communication with accessibility teams;
- Inadequate or poorly coordinated interventions.

Student Care aims to address these challenges through an assistive monitoring and notification system that supports accessibility professionals while respecting student autonomy and privacy.

---

## 3. General Objective

To develop a Computer Vision-based assistive system capable of identifying behavioral patterns that may indicate a potential crisis or need for assistance involving previously registered neurodivergent students, and notifying the university's Accessibility Coordination Office to enable an appropriate human response.

---

## 4. Specific Objectives

- Enable students to register voluntarily in the system;
- Collect accessibility-related information with informed consent;
- Allow students to configure individual support preferences;
- Identify registered students in authorized environments;
- Monitor predefined behavioral indicators during academic activities;
- Detect patterns that may suggest a need for assistance;
- Send alerts to the accessibility coordination team;
- Provide relevant, previously authorized support information;
- Preserve student privacy, autonomy, and dignity;
- Record events for system evaluation and improvement, in compliance with applicable data protection requirements.

---

## 5. Target Audience

The system is primarily intended for:

- Neurodivergent university students who voluntarily opt into the service;
- University accessibility coordination offices;
- Accessibility and student support professionals;
- Higher education institutions seeking assistive technology solutions.

System usage must be based on informed consent and adapted to each student's individual needs.

---

## 6. System Operation

### 6.1. Student Registration

Students will be able to register in advance through the platform and provide relevant information for individualized support.

Potential information includes:

- Student identification;
- System registration identifier;
- Communication preferences;
- Accessibility-related support requirements;
- Previously agreed support strategies;
- Authorized institutional contacts;
- Environments and activities in which monitoring is permitted.

The system should not require the disclosure of medical information beyond what is necessary for its assistive purpose.

### 6.2. Monitoring Configuration

Students will be able to authorize monitoring in specific environments, such as classrooms.

The configuration should consider:

- Student consent;
- Authorized environments;
- Monitoring schedules;
- Data processing purposes;
- Responsible accessibility personnel;
- Institutional privacy and security policies.

Monitoring must not be conducted covertly or without valid authorization.

### 6.3. Student Identification

During an authorized class session, the system may use Computer Vision techniques to identify the presence of a registered student.

Possible approaches include:

- Consent-based identity recognition;
- Authorized visual identifiers;
- Association between location, schedule, and registration;
- Non-biometric tracking and identification methods.

The team should carefully evaluate the risks associated with facial recognition and prioritize alternatives that minimize biometric data collection.

### 6.4. Behavioral Monitoring

Once the student's presence has been identified, the system may analyze observable visual indicators associated with potential discomfort or a need for assistance.

Examples of indicators to investigate include:

- Significant changes in movement patterns;
- Motor agitation;
- Intense repetitive movements;
- Attempts to leave the environment;
- Persistent behavioral changes;
- Individual indicators previously defined with qualified professionals.

These indicators do not independently confirm that a student is experiencing a crisis.

The system should use uncertainty-aware analysis and avoid automatically associating behavioral patterns with a diagnosis or clinical condition.

### 6.5. Potential Crisis Detection

The Artificial Intelligence module will analyze available data to identify patterns that may indicate a situation requiring attention.

The process may include:

1. Identifying the student in an authorized environment;
2. Collecting relevant visual information;
3. Extracting behavioral features;
4. Analyzing patterns over time;
5. Classifying potential attention events;
6. Applying confidence thresholds and false-positive reduction strategies;
7. Forwarding the event for human evaluation.

The output must be presented as an indication requiring attention, rather than a confirmed crisis or medical diagnosis.

### 6.6. Alert Notification

When predefined criteria are met, the system may notify the accessibility coordination team.

An alert may include:

- Student identifier;
- Authorized classroom or approximate location;
- Event timestamp;
- Detected indicator type;
- Priority level;
- Detection confidence score;
- Previously authorized support information;
- Individualized support guidelines.

The responsible team must assess the context and determine whether intervention is necessary.

### 6.7. Human Response and Event Closure

After receiving an alert, accessibility professionals may:

- Assess the situation;
- Determine whether assistance is required;
- Consult the student's registered support preferences;
- Provide appropriate assistance;
- Record the intervention when authorized;
- Close the event following human assessment.

The system must not perform physical interventions, issue diagnoses, or replace qualified professionals.

---

## 7. Proposed System Architecture

The Student Care architecture will be organized into independent modules, enabling parallel development and incremental improvement.

### 7.1. Core Modules

#### A. Student Registration Application

Responsibilities:

- Registration and authentication;
- Consent management;
- Support preference configuration;
- Monitoring permission management;
- Personal history visualization, where applicable.

#### B. Video Capture Module

Responsibilities:

- Receive video streams from authorized cameras;
- Process required video frames;
- Control capture frequency;
- Forward data to the Computer Vision module;
- Apply data protection and minimization strategies.

#### C. Computer Vision Module

Responsibilities:

- Student identification according to the authorized approach;
- Presence detection;
- Human pose estimation;
- Behavioral feature extraction;
- Temporal pattern analysis.

#### D. Event Detection Module

Responsibilities:

- Interpret extracted features;
- Identify attention-related patterns;
- Apply decision rules;
- Manage confidence thresholds;
- Reduce false positives;
- Forward events for human review.

#### E. Alert Management Module

Responsibilities:

- Manage notifications;
- Deliver alerts to the accessibility team;
- Control alert priorities;
- Track event status;
- Confirm notification delivery and handling.

#### F. Accessibility Coordination Dashboard

Responsibilities:

- Display authorized students and monitored environments;
- Receive and manage alerts;
- Access support information;
- Track active events;
- Record actions taken;
- Close events.

#### G. Database

Responsibilities:

- Store student registrations;
- Manage permissions;
- Store support preferences;
- Record events;
- Maintain institutional configurations;
- Store audit logs.

---

## 8. Proposed Technology Stack

The technology stack may be adjusted according to team expertise, available development time, and competition requirements.

### 8.1. Computer Vision and Artificial Intelligence

- Python;
- OpenCV;
- MediaPipe or another pose estimation framework;
- Machine Learning models for behavioral pattern classification;
- NumPy;
- PyTorch or TensorFlow, if custom model training is required.

### 8.2. Backend

- Python;
- FastAPI;
- Pydantic;
- WebSocket or another real-time communication mechanism;
- REST API for module integration.

### 8.3. Frontend


- React or another web framework for the administrative dashboard;
- Typescript;
- Responsive interfaces for accessibility professionals.

### 8.4. Database

- DuckDB
- Redis, if real-time event management is required.

### 8.5. Infrastructure and Development

- Docker;
- Git and GitHub;
- Local development environment;
- Application server;
- Environment variable and secret management.

The final technology selection should prioritize simplicity, reliability, and the ability to demonstrate a functional prototype during the hackathon.

---

## 9. Operational Workflow

```text
[Student Registration]
          |
          v
[Consent and Support Preferences]
          |
          v
[Monitoring Authorization]
          |
          v
[Class Session Begins]
          |
          v
[Visual Data Capture]
          |
          v
[Student Identification]
          |
          v
[Behavioral Pattern Analysis]
          |
          v
[Potential Event Detection]
          |
          v
[Alert Criteria Validation]
          |
          v
[Accessibility Team Notification]
          |
          v
[Human Assessment]
          |
          v
[Support and Event Recording]
```

---

## 10. Running the Project

Two services: `back/` (FastAPI + SQLite + the local skeleton-detection model) and `front/` (Next.js dashboard). Processing is 100% local — no video ever leaves the machine, only skeleton coordinates.

### 10.1. Docker Compose (recommended — single machine, e.g. the classroom PC with the webcam)

Prerequisite: Docker. Nothing else — the trained checkpoint and the MediaPipe pose model are committed to the repo so the build doesn't depend on internet access.

```bash
git clone <repo-url>
cd studentCare
docker compose up --build
```

- Front: http://localhost:3000
- Back: http://localhost:8000 (interactive docs at `/docs`)
- The back container gets `/dev/video0` passed through (see `docker-compose.yml`) so it can use the host's webcam. Comment out the `devices:` line if the machine has no camera, or on Windows/Mac (Docker Desktop doesn't expose `/dev/videoN`).
- Data persists in the `back_data` Docker volume (SQLite file), so it survives `docker compose restart`. Run `docker compose down -v` to wipe it and start fresh with the seed demo users.

### 10.2. Docker Swarm

```bash
./deploy-swarm.sh
```

Builds both images, initializes a swarm if needed, and runs `docker stack deploy -c docker-stack.yml studentcare`. Same URLs as above. **Limitation**: Swarm services don't support device passthrough (`devices:`), so a live webcam is not reachable in Swarm mode — use `docker compose` for that, or use the `camera_ip` / `arquivo` (.mp4) detection sources in Swarm (see 10.4).

### 10.3. What each container does

- **back**: FastAPI REST API, SQLite database, JWT auth, room/alert management, and the skeleton-based action-detection pipeline (OpenCV + MediaPipe Pose + a GRU trained on MMASD+). See `back/README.md` for the full endpoint list and the model's real limitations (it is not a crisis/diagnostic detector — read that before demoing it as one).
- **front**: Next.js dashboard with per-role views (aluno, professor, coacessi, admin). Talks to the back over REST; falls back to mock data if `NEXT_PUBLIC_USE_MOCK` isn't explicitly `false`.

### 10.4. Testing it end to end

Demo users (password `123456` for all): `aluno@teste.com`, `professor@teste.com`, `coacessi@teste.com`, `admin@teste.com`.

1. Open http://localhost:3000, log in as `professor@teste.com`.
2. Pick a room, then pick a detection source:
   - **Webcam** — uses the server's physical camera. This is a single shared channel: while it's running, *every* room shows this same feed/prediction (there's only one physical webcam).
   - **Vídeo de teste (.mp4)** — give an absolute path to a video file already on the server's disk (not an upload). Also a single shared channel like the webcam.
   - **Câmera IP** — uses the room's own `camera_url` (set it first in Admin → Salas). Each room with an IP camera runs its own independent detection channel, in parallel with the others.
3. Watch the skeleton overlay, predicted action, and confidence update (polling every ~1.5s) — never the raw video.
4. Log in as `admin@teste.com` to register rooms and their `camera_url`.
5. Log in as `coacessi@teste.com` to see incoming alerts and manage them.

Raw API check (no browser): `curl http://localhost:8000/health` should return `{"status":"ok"}`. Full endpoint reference: `back/README.md`.
