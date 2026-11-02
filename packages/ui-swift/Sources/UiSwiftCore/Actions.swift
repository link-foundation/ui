// Behaviour (docs/spec/behaviour.md): `(on <event> <action>...)` is data. The
// renderer never evaluates a string; it hands each checked action to the
// host as a `UiAction`. A handler that is not an action list, an unknown
// action and a `navigate` to a `javascript:`, `data:` or `vbscript:` target
// are dropped with a diagnostic.

/// One checked `(on <event> <action>...)` of an element.
public struct UiHandler: Equatable, Sendable {
    public let event: String
    /// The actions, each as its head and arguments (`["navigate", "home"]`): an
    /// atom is its text, a nested link its Links Notation (`(token a)`).
    public let actions: [[String]]

    public init(event: String, actions: [[String]]) {
        self.event = event
        self.actions = actions
    }
}

/// The handlers of an element, with the diagnostics of the dropped ones.
public func uiHandlers(of node: UiNode, vocabulary: UiVocabulary = .standard) -> (handlers: [UiHandler], diagnostics: [UiDiagnostic]) {
    var handlers: [UiHandler] = []
    var diagnostics: [UiDiagnostic] = []
    let at: [String: UiDiagnosticValue] = ["element": UiDiagnosticValue(node.id), "property": "on"]
    func report(_ found: [UiDiagnostic]) {
        diagnostics += found.map { UiDiagnostic(code: $0.code, severity: $0.severity, at: at) }
    }
    for property in node.properties(named: "on") {
        guard let event = property.values.first?.atom, property.values.count > 1 else {
            report(handlerDiagnostics(property.values, vocabulary))
            continue
        }
        var actions: [[String]] = []
        for action in property.values.dropFirst() {
            let problems = handlerDiagnostics([.atom(event), action], vocabulary)
            if !problems.isEmpty {
                report(problems)
                continue
            }
            actions.append(action.values!.map { $0.atom ?? $0.linoText })
        }
        if !actions.isEmpty {
            handlers.append(UiHandler(event: event, actions: actions))
        }
    }
    return (handlers, diagnostics)
}

extension Array where Element == UiHandler {
    /// The actions an event of the element `source` runs, in order.
    public func actions(for event: String, source: String?) -> [UiAction] {
        filter { $0.event == event }.flatMap { handler in
            handler.actions.map { UiAction(source: source ?? "", event: event, action: $0) }
        }
    }
}
