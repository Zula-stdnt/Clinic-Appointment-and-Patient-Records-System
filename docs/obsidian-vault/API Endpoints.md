---
tags: [api]
---

# API Endpoints

All controllers live in `api/` and return `{ success, message, data }` or `{ success, message, errors }` (see `includes/response.php`).

## Authentication
| Endpoint | Method | Action | Notes |
| --- | --- | --- | --- |
| `api/auth_controller.php?action=login` | POST | Login | JSON `{ username, password }`; returns `redirect`, `role`, `csrf_token` |
| `api/auth_controller.php?action=logout` | POST | Logout | Destroys session |
| `api/auth_controller.php?action=me` | GET | Session status | Returns current user + CSRF token |

## Master-file controllers
Each of the following follows the same contract and requires **Administrator** (except where noted):

| Controller | List | Read | Create | Update | Soft delete | Restore | Hard delete |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `user_controller.php` | `GET ?page&page_size&search&status&role&sort_by&sort_order` | `GET ?id` | `POST` | `PUT ?id` | `PUT/POST ?action=soft_delete&id` | `?action=restore&id` | `DELETE ?id` |
| `patient_controller.php` | `GET ?page&page_size&search&status&gender` | `GET ?id` | `POST` | `PUT ?id` | same | same | same |
| `doctor_controller.php` | `GET ?page&page_size&search&status&specialty_id` | `GET ?id` | `POST` | `PUT ?id` | same | same | same |
| `service_controller.php` | `GET ?page&page_size&search&status` | `GET ?id` | `POST` | `PUT ?id` | same | same | same |
| `specialty_controller.php` | `GET ?page&page_size&search&status` | `GET ?id` | `POST` | `PUT ?id` | same | same | same |
| `discount_controller.php` | `GET ?page&page_size&search&status` | `GET ?id` | `POST` | `PUT ?id` | same | same | same |

`status` accepts `active` (default), `deleted`, or `all`.

## Meta lookups
| Endpoint | Returns |
| --- | --- |
| `user_controller.php?meta=roles` | Doctor + Receptionist roles (for account forms) |
| `user_controller.php?meta=specialties` | Active specialties (for account forms) |
| `doctor_controller.php?meta=specialties` | Active specialties (for doctor forms) |

## Input validation rules
Across all master-file create and update endpoints:
- **Names**: `first_name` and `last_name` are required strings (max 80 chars). `middle_initial` is an optional string (max 5 chars).
- **Gender**: Required string (max 50 chars); supports `"Male"`, `"Female"`, `"Other"` (with custom specified text), and `"Unknown"` (for patients).
- **Contact Number**: `contact_no` is optional. If provided, spaces are stripped and it must be strictly numeric, exactly 11 digits, and start with `09` (e.g. `09171234567`).
- **Password**: Minimum 6 characters. Must satisfy complexity requirements: at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character (`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/`). On account updates, an empty password string preserves the existing password hash.

## Specialty payloads
`user_controller.php` and `doctor_controller.php` accept **`specialty_ids`** (array) on create/update:
```json
{
  "first_name": "Gregory",
  "last_name": "House",
  "middle_initial": "R",
  "gender": "Male",
  "contact_no": "09171234567",
  "username": "dr.house",
  "password": "Password123!",
  "specialty_ids": [2, 7]
}
```
The legacy single `specialty_id` value is still accepted for compatibility. Every submitted specialty must be active; the junction table is rewritten on update.

## Access rules
- All master-file endpoints: `require_login()` + `require_role('Administrator')`.
- Writes (POST/PUT/DELETE/PATCH) require a valid `X-CSRF-Token` header.
- Related records (e.g. appointments) block hard deletes; controllers respond `409`.
