# HIG-guided themes

These independently designed themes are guided by the Apple Human Interface
Guidelines (HIG). They are not affiliated with or endorsed by Apple. They use
only system font names and our own colours, geometry and CSS, without bundled
or downloaded Apple assets. HIG text and images are not reproduced here.

Load `hig`, `hig-ios` or `hig-macos` with `loadTheme` from
`@link-foundation/ui-themes`; pass the result in `themes` to `mountControls`.
Use `controlsVocabulary()` in `parseOptions.vocabulary`. The public
`compileThemeCss` compiler also works without a renderer. Shipped files are
separate inherited theme fragments; no build or network font request is needed.
See [the gallery](../../examples/themes/hig.html).

The default boundary follows the system appearance. Explicit `scheme light`
or `scheme dark`, `contrast more` and `motion reduced` use the ordinary #47
boundary contract. Increased contrast uses a deliberately opaque, light palette,
including when combined with dark appearance. Every declared foreground/fill
pair passes 4.5:1 without automatic correction in every combination.

## Sources and density

The #12 [digest](../guidelines/token-taxonomy.md) fixes semantic names but does
not supply the numeric tables anticipated by #50. We checked the primary HIG
sources on 2026-11-03 and chose the following values explicitly:

- [Typography](https://developer.apple.com/design/human-interface-guidelines/typography):
  the iOS Large text category ratios are large title 34/17, titles 28/17,
  22/17 and 20/17, headline/body 17/17, callout 16/17, subheadline 15/17,
  footnote 13/17 and captions 12/17 and 11/17. The base theme uses 1rem;
  iOS uses 1.0625rem (17 at a 16px root), macOS 0.8125rem (13).
  All sizes remain relative to the root and double at 200%. This is proportional
  web scaling, not a claim to reproduce every native Dynamic Type category.
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility):
  `size.target.min` is 44px for both web variants, with min-width and min-height
  applied to real focusable parts, including the slider thumb. Compact macOS
  visuals keep the same accessible web targets. Platform variants override only
  base text size, control height (46px / 32px) and list row height (52px / 36px).
  Heights and spacing are our density choices, not copied HIG constants.
- [Colour](https://developer.apple.com/design/human-interface-guidelines/color):
  surface, grouped background, primary/secondary labels, separator and tint
  roles carry HIG concept descriptions beside independently chosen values.
  Accent colours cover blue, brown, cyan, green, indigo, mint, orange, pink,
  purple, red, teal, yellow and gray. They are palette colours; use the declared
  semantic pairs for text and fills.
- [Motion](https://developer.apple.com/design/human-interface-guidelines/motion):
  our 180ms/350ms durations, 120ms fade, 0.35s spring response and 0.85 damping
  ratio are theme choices. `token motion.spring.default` with a nested `spring` value compiles to 41 bounded
  analytical `linear()` samples. For #52's native spring model, mass = 1,
  stiffness = (2π/response)² and damping coefficient = 2ζ√stiffness.
  Reduced motion uses stationary thumb positions that cross-fade when toggled.
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials):
  `material regular`, `material thin` and `material thick` use our blur/opacity
  tokens. The default is an opaque surface. Translucency activates only when
  backdrop-filter is supported, the OS permits transparency and the effective
  `transparency` comfort attribute is not `off`. User/session configuration
  therefore wins over the theme default. Compiler options `transparency: 'off'`
  or `reducedTransparency: true` omit all backdrop-filter declarations for static
  consumers. Forced colours keep system-colour surfaces and focus indicators.

## Controls and mapping

Buttons accept `bordered`, `borderless` and `prominent`. Switch, text-field,
slider, number-field, radio-group and select retain #34's native parts and
behaviour; the button uses the #47 part template. The other templates describe
root/label slots while those controls keep their existing native anatomy.
A segmented picker uses `radio-group` with `appearance segmented`. The gallery
stepper composes a number-field with decrement/increment buttons, using the same
store value and clamp bounds. Native SwiftUI rendering belongs to #29/#30.

`getSwiftuiMapping()` returns plain rows parsed by `src/mapping.js` using the
shared #48 format. `mapped` means an existing kind/prop match, not a source-code
converter. `partial` rows need composition or have different semantics;
`none` records a missing equivalent. Picker's segmented modifier needs a
radio-group conversion, Stepper needs its two buttons, ZStack needs overlay
layout and Label needs icon/text composition. Form, ScrollView and NavigationStack have no equivalent.

Regenerate this table with
`node packages/ui-themes/scripts/mapping-to-md.mjs`.

<!-- generated:swiftui:start -->

| SwiftUI view    | UI kind      | Status  | Modifiers                                                                                                                               |
| --------------- | ------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Button          | button       | mapped  | buttonStyle bordered → variant bordered; buttonStyle borderless → variant borderless; buttonStyle borderedProminent → variant prominent |
| Toggle          | switch       | mapped  |                                                                                                                                         |
| TextField       | text-field   | mapped  |                                                                                                                                         |
| SecureField     | text-field   | mapped  | secure true → type password                                                                                                             |
| Slider          | slider       | mapped  |                                                                                                                                         |
| Stepper         | number-field | partial |                                                                                                                                         |
| Picker          | select       | partial | pickerStyle segmented → appearance segmented                                                                                            |
| List            | list         | partial |                                                                                                                                         |
| Form            | form         | none    |                                                                                                                                         |
| Section         | stack        | partial |                                                                                                                                         |
| VStack          | stack        | mapped  | axis vertical → direction vertical                                                                                                      |
| HStack          | stack        | mapped  | axis horizontal → direction horizontal                                                                                                  |
| ZStack          | stack        | partial |                                                                                                                                         |
| ScrollView      | scroll-area  | none    |                                                                                                                                         |
| TabView         | tabs         | partial |                                                                                                                                         |
| NavigationStack | navigation   | none    |                                                                                                                                         |
| Sheet           | dialog       | partial |                                                                                                                                         |
| Alert           | alert-dialog | partial |                                                                                                                                         |
| Menu            | menu         | mapped  |                                                                                                                                         |
| ProgressView    | progress     | mapped  |                                                                                                                                         |
| Label           | label        | partial |                                                                                                                                         |
| Image           | image        | mapped  |                                                                                                                                         |

<!-- generated:swiftui:end -->

## Verification

```sh
node --test packages/ui-themes/tests/hig-*.test.js packages/ui-themes/tests/swiftui-mapping.test.js
npx playwright test tests/e2e/theme-hig.spec.js --workers=1
```

The browser tests measure every native hit target, all eleven type styles at
100%/200%, keyboard selection, stepper buttons, system appearance, explicit and
OS transparency/motion preferences, and axe. Screenshots cover both platforms
in light, dark and increased contrast.
