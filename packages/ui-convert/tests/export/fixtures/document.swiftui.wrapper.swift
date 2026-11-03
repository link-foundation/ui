import SwiftUI

struct App: View {
    var actions: [String: ([String]) -> Void] = [:]

    var body: some View {
        Group {
            Group {
                VStack(spacing: Tokens.spaceMedium) {
                    Text("Hello, links")
                    Button("OK") {
                        actions["navigate"]?(["home"])
                    }
                        .buttonStyle(.borderedProminent)
                }
            }
        }
    }
}
