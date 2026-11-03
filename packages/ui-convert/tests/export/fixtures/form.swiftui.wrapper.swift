import SwiftUI

struct App: View {
    var actions: [String: ([String]) -> Void] = [:]
    @State private var field0 = ""
    @State private var field1 = false

    var body: some View {
        Group {
            // Unsupported property tag on login for swiftui
            // Unsupported property attr on login for swiftui
            // Unsupported kind html on login for swiftui
            Group {
                // Unsupported property tag on email-label for swiftui
                // Unsupported property attr on email-label for swiftui
                Text("Email")
                // Unsupported property attr on email for swiftui
                // Unsupported property attr on email for swiftui
                // Unsupported property attr on email for swiftui
                TextField("", text: $field0)
                // Unsupported property attr on remember for swiftui
                // Unsupported property attr on remember for swiftui
                Toggle("", isOn: $field1)
                Button("Sign in") {
                }
            }
        }
    }
}
