# IPOSB account layers

FMS web (`iposb-web`) and the mobile API use different account types. Do not mix them.

## Layers

| Layer | Purpose | Login? | Storage | UI / API |
|---|---|---|---|---|
| **Staff** | Office FMS users | Yes (web) | `t_user.app_role` | User Management `/admin/users` |
| **Billing customer / shipper** | Account for CN billing, invoicing, loyalty | No (master data) | `t_customer` | Customer / Shipper Accounts `/admin/customers` |
| **Mobile app user** | End customer, driver, dispatcher | Yes (mobile) | `t_mobile_user.role` | Mobile `POST /api/auth/register` + Staff Verification for driver/dispatcher |
| **Seller / receiver** | Parties on a consignment | No | CN fields (`consigner`, `recp_name`, addresses, …) | Consignment Entry |

## Staff roles (assignable)

Super Admin, Admin, Hub Manager, Droppoint Manager, Operation, Agent, Invoice, CSL.

**Not assignable as `app_role`:** Seller, Receiver, Customer (as a login role).

Laravel enforces this in `RbacService::assertAssignableStaffRole()` when saving users via `/api/ops/admin/users`.

## Practical mapping

- **Seller / shipper** → pick or create a `t_customer` account on the CN (or free-text consigner).
- **Receiver / consignee** → name, phone, address on the CN; no FMS user required.
- **Someone who needs an app** to book/track → mobile role `customer`, not FMS User Management.
