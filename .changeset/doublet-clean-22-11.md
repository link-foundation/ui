---
'@link-foundation/ui-components': patch
---

Make the doublet renderer draw the clean `22 11` input of the collision solver
without painted collisions:

- Fixed end angles turn toward the mirror side.
- Links whose two references cancel share one middle direction.
- Start and end gaps at another link's middle move the visible end back along
  its tangent.

Add the shared LiNo fixture and a painted regression test.
