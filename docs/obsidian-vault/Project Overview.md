---
tags: [overview]
---

# Project Overview

A hospital back-office system for managing patient records, doctor profiles, medical services, specialties, discounts, user accounts, and archived (soft-deleted) records.

## Roles
- **Administrator** — full access to Master Files and the Central Archive. Lands on the admin dashboard shell.
- **Doctor** — dedicated portal (currently a placeholder view).
- **Receptionist** — dedicated portal (currently a placeholder view).

## Feature summary
- Master file CRUD: Users, Patients, Doctors, Services, Specialties, Discounts.
- Doctor accounts can hold **multiple clinical specialties**.
- All deletes are **soft deletes** (`deleted_at`); records move to [[Manage Archive]] where they can be restored or permanently deleted.
- Server-side validation with per-field error payloads rendered inline in modal forms.
- Role-based access control, CSRF-protected state changes, and login throttling — see [[Security]].

## Technology stack
| Layer | Choice |
| --- | --- |
| Backend | PHP 8.x, PDO prepared statements |
| Database | MySQL 5.7+ / MariaDB 10.4+ (`hospital_db`) |
| Frontend | Vanilla JS ES modules (hash SPA), Axios |
| Styling | Custom CSS design system (hospital green) |
| Server | Apache via WAMP |

## Repository layout
See [[Architecture#Folder map]] and the project `README.md` for setup instructions. [[Setup (WAMP)]] covers this workstation specifically.
