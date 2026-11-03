/**
 * The ui-dialect/0 vocabulary, byte-equal to docs/spec/vocabulary.lino (a
 * test keeps the two in sync). It is embedded as a module so that the
 * package works in every JavaScript runtime without file system access.
 */
export const VOCABULARY_TEXT = `ui-dialect: dialect
  version 'ui-dialect/0'
  multi-valued on token track key event set state media
  reserved-sigil at-sign dollar-sign
  reserved-property bind
  reserved-property when
  common-property note string multi
  common-property machine any

document: kind
  description 'Root of a UI document.'
  property title string
  property theme element-ref
  property lang string
  children any

stack: kind
  description 'Lays its children out in one direction.'
  property direction
    enum vertical horizontal
  property gap dimension
  property padding dimension
  property align
    enum start center end stretch
  property style element-ref
  children any

text: kind
  description 'A run of text.'
  positional value
  property value string
  property style element-ref
  property bind any
  children none

button: kind
  description 'A pressable control.'
  positional label
  property label string
  property variant
    enum filled outlined text
  property disabled
    enum true false
  property style element-ref
  property on action multi
  property bind any
  children none

image: kind
  description 'A raster or vector image.'
  positional source
  property source url
  property asset element-ref
  property alt string
  property width dimension
  property height dimension
  property aspect any
  children none

theme: kind
  description 'A named set of design tokens.'
  property extends element-ref
  property token any multi
  children none

style: kind
  description 'A style rule.'
  property selector any
  property background color
  property color color
  property radius dimension
  property padding dimension
  property elevation number
  property opacity number
  property scale number
  property state any multi
  property media any multi
  children none

animation: kind
  description 'A keyframe animation of one target.'
  property target element-ref
  property duration duration
  property delay duration
  property easing
    enum standard linear emphasized decelerate accelerate
  property track any multi
  children none

recording: kind
  description 'A recorded sequence of input and state events.'
  property started string
  property event any multi
  children none

overrides: kind
  description 'A layer of patches over a base document.'
  property layer
    enum system app user session
  property base element-ref
  property set any multi
  children none

asset: kind
  description 'A third-party or own asset record (fields owned by issue 10).'
  property kind
    enum icon image font sound
  property source url
  property license string
  property copyright string
  property notice url
  children none

machine: kind
  description 'A behaviour state machine; see behaviour.md.'
  property initial string
  property context any multi
  property action any multi
  property state any multi
  property part any multi
  children none

navigate: action
  description 'Go to an element id or a quoted URL.'
  argument target element-ref-or-url

emit: action
  description 'Send a named event to the host application.'
  argument event string

set: action
  description 'Set a property of an element.'
  argument target element-ref
  argument property string
  argument value any

toggle: action
  description 'Flip a boolean property of an element.'
  argument target element-ref
  argument property string

focus: action
  description 'Move keyboard focus to an element.'
  argument target element-ref

dialog: kind
  description 'The dialog overlay/navigation primitive.'
  property title string
  property body any
  property actions any
  property open
    enum true false
  property on action multi
  children any

alert-dialog: kind
  description 'The alert-dialog overlay/navigation primitive.'
  property title string
  property body any
  property actions any
  property open
    enum true false
  property on action multi
  children any

popover: kind
  description 'The popover overlay/navigation primitive.'
  property anchor element-ref
  property label string
  property placement string
  property offset number
  property open
    enum true false
  property on action multi
  children any

tooltip: kind
  description 'The tooltip overlay/navigation primitive.'
  property anchor element-ref
  property label string
  property value string
  property on action multi
  children none

menu: kind
  description 'The menu overlay/navigation primitive.'
  property anchor element-ref
  property label string
  property placement string
  property open
    enum true false
  property on action multi
  children any

menu-item: kind
  description 'The menu-item overlay/navigation primitive.'
  positional label
  property label string
  property icon string
  property disabled
    enum true false
  property on action multi
  children any

menu-separator: kind
  description 'The menu-separator overlay/navigation primitive.'
  property on action multi
  children none

context-menu: kind
  description 'The context-menu overlay/navigation primitive.'
  property anchor element-ref
  property label string
  property long-press number
  property on action multi
  children any

radial-menu: kind
  description 'The radial-menu overlay/navigation primitive.'
  property anchor element-ref
  property label string
  property radius number
  property start-angle number
  property presentation
    enum radial linear
  property item any multi
  property on action multi
  children any

tabs: kind
  description 'The tabs overlay/navigation primitive.'
  property label string
  property activation
    enum automatic manual
  property active element-ref
  property on action multi
  children any

tab: kind
  description 'The tab overlay/navigation primitive.'
  positional label
  property label string
  property panel element-ref
  property disabled
    enum true false
  property on action multi
  children any

tab-panel: kind
  description 'The tab-panel overlay/navigation primitive.'
  property on action multi
  children any

toast: kind
  description 'The toast overlay/navigation primitive.'
  positional label
  property label string
  property duration number
  property politeness
    enum polite assertive
  property on action multi
  children none

toaster: kind
  description 'The toaster overlay/navigation primitive.'
  property max number
  property on action multi
  children any

drawer: kind
  description 'The drawer overlay/navigation primitive.'
  property title string
  property body any
  property actions any
  property open
    enum true false
  property modal
    enum true false
  property side
    enum left right top bottom
  property on action multi
  children any
`;
