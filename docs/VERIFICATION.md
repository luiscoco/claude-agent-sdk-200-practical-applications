# Verification scope

The repository contains all 200 application folders. Existence is separate from successful live inference and production readiness.

The latest source build (23 November 2026) verified the 33 examples numbered 7–9 and 171–200 with TypeScript checks, their scoped local integration checks, and desktop/mobile Chrome checks. The dedicated chat page in prompt 185 was also checked, and prompt 197 executed its Python local port. No paid model inference was attempted in that batch because replacement credentials were not locally configured. Other applications retain their own lesson verification notes; no new claim is made here that all 200 were re-tested for this publication.

Prompts 7–9 require real provider access checks. Prompt 171 requires image execution with a working container daemon. Prompt 175 confirms fail-closed startup on unsupported Windows; command containment requires a supported host. Prompt 180 ran its bundle on the development host and still needs a clean target-machine check. Prompt 200 lists source references and coverage gaps; it does not certify every SDK option, type or entrypoint.

Recordings, instructor run state and private credential/configuration files are deliberately not published. Prompts 096, 097 and 100 include required historical transcripts from owned synthetic classroom experiments; their machine paths are sanitized and their public provenance hashes updated. The three affected integration tests passed again after this publication preparation. These fixtures are disclosed as recorded data, not new model runs.

Run the tests in a selected application to generate your own evidence. A passing local fixture is never a substitute for observing the required real tool calls and model response in a live exercise.
