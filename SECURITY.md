# Security Considerations

## Trust Model

YieldProp MVP uses role-based access control. Key trust assumptions:

### PropertyToken (ERC-1400)

| Role | Capability | Trust |
|------|------------|-------|
| `DEFAULT_ADMIN_ROLE` | Grant/revoke other roles, renounce control/issuance | **Critical** – uses 2-step transfer with 2-day delay |
| `PROPERTY_MANAGER_ROLE` | Whitelist, documents, partition operators | High – controls who can hold/transfer |
| `CONTROLLER_ROLE` | Force transfer, force redeem | High – can move/burn tokens |
| `ISSUER_ROLE` | Mint new tokens | High – affects supply |

### PriceManager

| Role | Capability | Trust |
|------|------------|-------|
| `DEFAULT_ADMIN_ROLE` | Grant/revoke roles | **Critical** – 2-step transfer, 2-day delay |
| `PROPERTY_MANAGER_ROLE` | Submit, accept, reject recommendations | High – sets rental price |

### YieldDistributor

| Role | Capability | Trust |
|------|------------|-------|
| `DEFAULT_ADMIN_ROLE` | Grant/revoke roles | **Critical** – 2-step transfer, 2-day delay |
| `PROPERTY_MANAGER_ROLE` | Distribute yields, register holders | High – controls distribution |
| `PAYMENT_PROCESSOR_ROLE` | Submit rental payments | High – funds intake |

## Admin Transfer (2-Step with Delay)

All contracts use `AccessControlDefaultAdminRules` for `DEFAULT_ADMIN_ROLE`:

- **Delay:** 2 days (configurable at deployment)
- **Process:** `beginDefaultAdminTransfer(newAdmin)` → wait 2 days → `acceptDefaultAdminTransfer()`
- **Safety:** Pending transfer can be cancelled; prevents accidental lockouts

## Recommendations for Production

1. **Use a multisig** (e.g. Gnosis Safe) as `DEFAULT_ADMIN_ROLE` holder
2. **Monitor** `RoleGranted`, `RoleRevoked`, and admin transfer events
3. **Separate** property manager from deployer where possible
4. **Payment validation** is enforced when PriceManager is linked to YieldDistributor

## Reentrancy

- **YieldDistributor:** `nonReentrant` on `receiveRentalPayment` and `distributeYields`
- **PropertyToken:** Uses `ReentrancyGuard` for defense in depth (ERC20 transfers)

## Reporting Vulnerabilities

For security concerns, please open a GitHub issue or contact the team.
