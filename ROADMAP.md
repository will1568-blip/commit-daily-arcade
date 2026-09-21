# SLIP roadmap

SLIP is an active MVP. The current milestone proves the game loop, deterministic replay validation, daily-attempt enforcement, and ranked score model before public release.

## Current milestone

- [x] Mobile-first pointer controls with a fixed 360 × 640 logical playfield
- [x] Fixed-step simulation and swept collision detection
- [x] Deterministic weekly obstacle configuration
- [x] Gates, tunnels, mazes, rotating hazards, tracking turrets, and risk/reward tokens
- [x] Twilio Verify phone authentication integration
- [x] Atomic one-attempt-per-number-per-day authorization
- [x] Idempotent run creation and score submission
- [x] Server replay validation and pending offline submissions
- [x] Daily and weekly global leaderboards with tied ranks
- [x] Archived period standings and attempt history

## Before a public beta

- [ ] Configure a production Twilio Verify service and protected secrets
- [ ] Provision and migrate the production D1 database
- [ ] Complete real-device play testing across representative iPhone and Android models
- [ ] Add automated browser coverage for authentication and full run flows
- [ ] Add monitoring, abuse controls, privacy policy, and account deletion
- [ ] Complete accessibility and reduced-motion review

## Later work

- [ ] Weekly game rotation and versioned rule sets
- [ ] Stronger anti-automation controls and device attestation
- [ ] Configurable prize rules after legal and operational review

The repository does not offer prizes or cash payouts. Any prize feature would require a separate release and review.
