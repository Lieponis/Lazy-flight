# Conventions

## The layer rule

The universe is built in layers, from big to small:

**galaxy > system > planet > dock > jobs**

(A "dock" is either a surface outpost or an orbiting station. Both work the same way.)

- Each layer may only use layers **before** it. A planet can use its system; a system can never use its planets' jobs.
- Never the reverse. No exceptions.

## Code folders follow the same idea

- `src/universe` is pure logic. It **never** imports Three.js, `render`, `ui`, `game` or `save`. (`tests/layer-rule.test.ts` enforces this.)
- `src/game` may use `universe`.
- `src/render` and `src/ui` may use `universe` and `game`.
- `src/save` stores player progress only, never the universe.

## Seeds

Everything in the universe is computed from the seed plus coordinates. Same seed gives the same universe. Nothing generated is stored.

## Other house rules

- Build in small steps. Every phase ends with a working build and a live link.
- Report problems honestly. Label unrequested ideas as "suggestion".
- No new libraries without Andy's approval.
- Render size lives in one place: `src/settings.ts`.
