# Project TODOS & Deferred Enhancements

## High-Priority Post-V1 Enhancements

### 1. Multi-Store Data Synchronization Engine
- **What:** Background push-based synchronization worker pushing local store transactions to a central PostgreSQL aggregation database.
- **Why:** Enables owner cross-store visibility across all 2-3 branches while preserving local store offline resilience.
- **Pros:** Full visibility across branches without risking local store counter availability during internet drops.
- **Cons:** Requires conflict-free replication design and sync monitoring.
- **Context:** Decided in ADR-0001 to defer until single-store core operations are fully validated.
- **Depends on:** Multi-store network infrastructure and unique store UUID identification.

### 2. Direct Thermal Printer Driver Integration (ESC/POS)
- **What:** Native ESC/POS USB and network receipt printer integration for automatic silent receipt cutting without browser print dialog.
- **Why:** Shaves 2-3 seconds off each retail counter sale.
- **Pros:** Instant silent receipt printing on receipt submission.
- **Cons:** Platform-specific USB/serial drivers required on the counter machine.
- **Context:** Browser print (Ctrl+P) with tailored 80mm CSS media styles currently handles all receipt printing smoothly.

### 3. KRA TIMS Hardware / VSCU Protocol Integration
- **What:** Direct fiscal device middleware integration sending cryptographic invoice signatures to KRA in real-time.
- **Why:** Fully automates tax compliance for stores requiring electronic fiscal signature devices.
- **Pros:** Automated invoice validation.
- **Cons:** High vendor lock-in, hardware failure points, requires physical device pairing.
- **Context:** Current `is_etr` boolean flag allows full separation of compliant reporting without fiscal hardware instability.

