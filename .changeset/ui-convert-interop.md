---
'@link-foundation/ui-convert': minor
---

Add the `@link-foundation/ui-convert` package with import and export pairs for A2UI 0.9.1 (`importA2ui`, `exportA2ui`, `a2uiMessagesToDiffs`, `A2uiStream`), Adaptive Cards 1.6 (`importAdaptiveCard`, `exportAdaptiveCard` with `targetVersion` fallbacks, `hostConfigToTheme`), JSON Forms 3 (`importJsonForms`, `exportJsonForms`) and Lottie 1.0 (`importLottie`, `exportLottie`), plus `detectFormat` and the `ui-convert import|export` command line. Unknown properties survive a round trip in `(extra <format> '<json>')`, every lossy step reports a diagnostic, and expressions, templates and scripts are never evaluated.
