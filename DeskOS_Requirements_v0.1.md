# DeskOS - Requirements Specification (Version 0.1)

## 1. Vision

DeskOS is a personal information appliance running on a Raspberry Pi
connected to a portable monitor. The goal is to create a
distraction-free, full-screen dashboard that combines a digital
newspaper, investment dashboard, home automation, AI utilities, and
other personal applications.

The application should behave like a dedicated appliance rather than a
traditional desktop computer.

------------------------------------------------------------------------

# 2. Objectives

## Functional

-   Boot directly into DeskOS.
-   Full-screen kiosk experience.
-   Left navigation panel.
-   Large content panel.
-   Support multiple applications through a plugin architecture.
-   Initial application: Newspaper Reader.

## Non-functional

-   Develop entirely on macOS.
-   Deploy unchanged to Raspberry Pi.
-   Modular architecture.
-   TypeScript throughout frontend and backend.
-   Local-first operation where practical.

------------------------------------------------------------------------

# 3. Hardware

## Confirmed Hardware

-   Raspberry Pi (target deployment)
-   Koorui portable monitor (HDMI)
-   USB-C power bank
-   Wireless keyboard and mouse (USB dongle)

------------------------------------------------------------------------

# 4. Technology Stack

Frontend - React - TypeScript - Vite

Backend - Node.js - Express (initial implementation)

Database - SQLite (future)

Browser - Chromium

Development - macOS

Deployment - Raspberry Pi OS

------------------------------------------------------------------------

# 5. Startup Sequence

1.  Raspberry Pi boots.
2.  systemd starts DeskOS backend.
3.  Backend starts Express server.
4.  Chromium launches in kiosk mode.
5.  Chromium opens http://localhost:`<port>`{=html}

------------------------------------------------------------------------

# 6. User Interface

Layout

  -------------------------------------------------------------
  Sidebar \| \| \| Content Area \| \|

  -------------------------------------------------------------

Sidebar (Initial)

-   The Hindu
-   LiveMint
-   Other News
-   Raspberry Pi Desktop

Future

-   Investments
-   Home Automation
-   AI Assistant
-   Calendar
-   Weather
-   Garden
-   Settings

------------------------------------------------------------------------

# 7. Newspaper Module

Phase 1

Purpose

Provide access to official subscriber ePaper editions.

Supported sources

-   The Hindu
-   LiveMint

Requirements

-   Preserve login session.
-   Open official ePaper.
-   Full-screen reading.
-   Keyboard and mouse navigation.

Future

-   RSS aggregation
-   AI summaries
-   Cross-source search
-   Personal clipping library

------------------------------------------------------------------------

# 8. Plugin Architecture

Each application will be implemented as a plugin.

Proposed interface

Plugin

-   id
-   name
-   icon

Methods

-   render()
-   activate()
-   deactivate()
-   refresh()

Examples

News Plugin Investment Plugin Home Automation Plugin AI Plugin Calendar
Plugin

------------------------------------------------------------------------

# 9. Platform Abstraction

Platform-specific functionality must be isolated.

Examples

-   Exit to Desktop
-   Shutdown
-   Reboot
-   GPIO
-   Brightness

Development implementation

Mock implementations for macOS.

Deployment implementation

Native Raspberry Pi implementation.

------------------------------------------------------------------------

# 10. Development Strategy

Stage 1

-   Build and test on macOS.

Stage 2

-   Deploy unchanged to Raspberry Pi.

Stage 3

-   Add Raspberry Pi specific services.

------------------------------------------------------------------------

# 11. Future Roadmap

Phase 2

-   Investment dashboard
-   Home Assistant integration
-   AI assistant
-   Weather
-   Calendar

Phase 3

-   Voice commands
-   Smart notifications
-   Camera feeds
-   Garden monitoring
-   YouTube analytics

------------------------------------------------------------------------

# 12. Design Principles

-   Appliance first.
-   Local-first where possible.
-   Plugin-based architecture.
-   Clean separation between UI, backend, and platform services.
-   Develop once on macOS, deploy to Raspberry Pi with minimal changes.
-   Prefer extensibility over one-off implementations.
