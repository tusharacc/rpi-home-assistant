# DeskOS Requirements (v0.2)

## Overview

DeskOS is a Raspberry Pi based portable operating environment running on
a Koorui portable monitor. It provides a distraction-free reading and
productivity experience with future expansion into home automation,
investments and AI.

## Hardware

-   Raspberry Pi 4
-   Koorui portable monitor
-   20,000 mAh USB-C PD power bank
-   Wireless keyboard and mouse (single USB dongle)
-   Short HDMI cable with Micro-HDMI adapter (Pi) and Mini-HDMI
    connection (monitor)

## Boot

-   Auto boot into Raspberry Pi OS
-   Start Node.js backend automatically
-   Launch Chromium in kiosk/full-screen mode
-   Auto start DeskOS

## Functional Modules

### Home Screen

-   News
-   Investments
-   Home Automation
-   Raspberry Pi Desktop
-   Settings

### Newspaper

-   Read newspapers page by page.
-   Future support for multiple providers.

## System Features

### Lightweight Mode

-   Disable unused startup services.
-   Disable Bluetooth when not required.
-   Disable unnecessary desktop applications.
-   Keep Wi-Fi enabled.
-   Pause background plugins when idle.

### Standby

-   Turn off HDMI output or blank display.
-   Pause refresh jobs.
-   Keep Wi-Fi active.
-   Keep Node.js backend alive.
-   Resume instantly on keyboard or mouse activity.

### Shutdown

-   Save application state.
-   Execute Linux shutdown.
-   Display 'Safe to switch off power.'

### Display Rotation

-   Portrait button.
-   Landscape button.
-   Persist orientation across reboot.

### Settings

-   Brightness (future)
-   Orientation
-   Theme (future)
-   Wi-Fi status
-   System information

## Architecture

Frontend: - Electron or Chromium-based web UI - Responsive layout

Backend: - Node.js - Express - REST APIs

## Future Roadmap

-   Home Assistant integration
-   AI Assistant
-   Investment Dashboard
-   Battery monitoring
-   Plugin framework
-   ESP32 power controller
