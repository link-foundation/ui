// A verbatim copy of docs/spec/vocabulary.lino (checked byte for byte by
// VocabularyTests), so that the package needs no resource bundle.

/// The text of `docs/spec/vocabulary.lino`, the machine-readable v0 kinds,
/// properties and actions.
public let uiVocabularyText = #"""
ui-dialect: dialect
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
    enum filled tonal outlined text
  property icon string
  property type
    enum button submit reset
  property disabled boolean
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

icon-button: kind
  description 'A button that shows only an icon; its label is the accessible name.'
  positional icon
  property icon string
  property label string
  property variant
    enum filled tonal outlined text
  property type
    enum button submit reset
  property disabled boolean
  property style element-ref
  property on action multi
  property bind any
  children none

label: kind
  description 'The visible name of a form control.'
  positional value
  property value string
  property for element-ref
  property required boolean
  property style element-ref
  children none

link: kind
  description 'Goes to a URL or an element; javascript: URLs are rejected.'
  positional label
  property label string
  property href element-ref-or-url
  property external boolean
  property style element-ref
  property on action multi
  children none

text-field: kind
  description 'A single-line text input.'
  positional label
  property label string
  property name string
  property value string
  property placeholder string
  property type
    enum text email password search tel url
  property autocomplete string
  property required boolean
  property readonly boolean
  property disabled boolean
  property invalid boolean
  property style element-ref
  property on action multi
  property bind any
  children none

text-area: kind
  description 'A multi-line text input.'
  positional label
  property label string
  property name string
  property value string
  property placeholder string
  property rows number
  property required boolean
  property readonly boolean
  property disabled boolean
  property invalid boolean
  property style element-ref
  property on action multi
  property bind any
  children none

number-field: kind
  description 'A number input that steps with the arrow, Page, Home and End keys.'
  positional label
  property label string
  property name string
  property value number
  property min number
  property max number
  property step number
  property required boolean
  property readonly boolean
  property disabled boolean
  property invalid boolean
  property style element-ref
  property on action multi
  property bind any
  children none

color-field: kind
  description 'A hex colour text input with the native colour picker.'
  positional label
  property label string
  property name string
  property value color
  property required boolean
  property disabled boolean
  property invalid boolean
  property style element-ref
  property on action multi
  property bind any
  children none

checkbox: kind
  description 'A box that is checked, unchecked or mixed.'
  positional label
  property label string
  property name string
  property value string
  property checked
    enum true false mixed
  property required boolean
  property disabled boolean
  property invalid boolean
  property style element-ref
  property on action multi
  property bind any
  children none

radio-group: kind
  description 'A set of radio buttons with one tab stop; the arrows move and select.'
  positional label
  property label string
  property name string
  property value string
  property orientation
    enum vertical horizontal
  property required boolean
  property disabled boolean
  property invalid boolean
  property style element-ref
  property on action multi
  property bind any
  children any

radio: kind
  description 'One choice of a radio group.'
  positional label
  property label string
  property value string
  property disabled boolean
  property style element-ref
  children none

switch: kind
  description 'An on/off switch that applies at once.'
  positional label
  property label string
  property name string
  property value string
  property checked boolean
  property disabled boolean
  property style element-ref
  property on action multi
  property bind any
  children none

slider: kind
  description 'Picks a number in a range by dragging or with the keyboard.'
  positional label
  property label string
  property name string
  property value number
  property min number
  property max number
  property step number
  property value-text string
  property orientation
    enum horizontal vertical
  property disabled boolean
  property style element-ref
  property on action multi
  property bind any
  children none

select: kind
  description 'A select-only combobox: picks one option from a list.'
  positional label
  property label string
  property name string
  property value string
  property placeholder string
  property required boolean
  property disabled boolean
  property invalid boolean
  property style element-ref
  property on action multi
  property bind any
  children any

combobox: kind
  description 'A text input that filters a list of options.'
  positional label
  property label string
  property name string
  property value string
  property placeholder string
  property required boolean
  property disabled boolean
  property invalid boolean
  property style element-ref
  property on action multi
  property bind any
  children any

option: kind
  description 'One option of a select or a combobox.'
  positional label
  property label string
  property value string
  property disabled boolean
  children none

progress: kind
  description 'Shows how far a task is; without a value it is indeterminate.'
  positional label
  property label string
  property value number
  property max number
  property style element-ref
  children none

badge: kind
  description 'A short status text or count.'
  positional value
  property value string
  property label string
  property tone
    enum neutral primary error
  property style element-ref
  children none

avatar: kind
  description 'A picture of a person or thing, with initials when there is none.'
  positional name
  property name string
  property source url
  property size
    enum small medium large
  property style element-ref
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

code-editor: kind
  description 'A labelled multi-document source editor with persistent drafts.'
  property label string
  property document-id string
  property title string
  property value string
  property language
    enum lino javascript css json markdown
  property engine
    enum codemirror monaco
  property on action multi
  children none

"""#
