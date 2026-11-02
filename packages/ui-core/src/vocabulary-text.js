/**
 * The ui-dialect/0 vocabulary, byte-equal to docs/spec/vocabulary.lino (a
 * test keeps the two in sync). It is embedded as a module so that the
 * package works in every JavaScript runtime without file system access.
 */
export const VOCABULARY_TEXT = `(ui-dialect: dialect
  (version 'ui-dialect/0')
  (multi-valued on token track key event set state media)
  (reserved-sigil at-sign dollar-sign)
  (reserved-property bind)
  (reserved-property when))

(document: kind
  (description 'Root of a UI document.')
  (property title string)
  (property theme element-ref)
  (property lang string)
  (children any))

(stack: kind
  (description 'Lays its children out in one direction.')
  (property direction (enum vertical horizontal))
  (property gap dimension)
  (property padding dimension)
  (property align (enum start center end stretch))
  (property style element-ref)
  (children any))

(text: kind
  (description 'A run of text.')
  (positional value)
  (property value string)
  (property style element-ref)
  (property bind any)
  (children none))

(button: kind
  (description 'A pressable control.')
  (positional label)
  (property label string)
  (property variant (enum filled outlined text))
  (property disabled (enum true false))
  (property style element-ref)
  (property on action multi)
  (property bind any)
  (children none))

(image: kind
  (description 'A raster or vector image.')
  (positional source)
  (property source url)
  (property asset element-ref)
  (property alt string)
  (property width dimension)
  (property height dimension)
  (property aspect any)
  (children none))

(theme: kind
  (description 'A named set of design tokens.')
  (property extends element-ref)
  (property token any multi)
  (children none))

(style: kind
  (description 'A style rule.')
  (property selector any)
  (property background color)
  (property color color)
  (property radius dimension)
  (property padding dimension)
  (property elevation number)
  (property opacity number)
  (property scale number)
  (property state any multi)
  (property media any multi)
  (children none))

(animation: kind
  (description 'A keyframe animation of one target.')
  (property target element-ref)
  (property duration duration)
  (property delay duration)
  (property easing (enum standard linear emphasized decelerate accelerate))
  (property track any multi)
  (children none))

(recording: kind
  (description 'A recorded sequence of input and state events.')
  (property started string)
  (property event any multi)
  (children none))

(overrides: kind
  (description 'A layer of patches over a base document.')
  (property layer (enum system app user session))
  (property base element-ref)
  (property set any multi)
  (children none))

(asset: kind
  (description 'A third-party or own asset record (fields owned by issue 10).')
  (property kind (enum icon image font sound))
  (property source url)
  (property license string)
  (property copyright string)
  (property notice url)
  (children none))

(navigate: action
  (description 'Go to an element id or a quoted URL.')
  (argument target element-ref-or-url))

(emit: action
  (description 'Send a named event to the host application.')
  (argument event string))

(set: action
  (description 'Set a property of an element.')
  (argument target element-ref)
  (argument property string)
  (argument value any))

(toggle: action
  (description 'Flip a boolean property of an element.')
  (argument target element-ref)
  (argument property string))

(focus: action
  (description 'Move keyboard focus to an element.')
  (argument target element-ref))
`;
