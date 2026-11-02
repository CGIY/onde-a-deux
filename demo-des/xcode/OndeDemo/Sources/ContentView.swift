import SwiftUI

struct ContentView: View {
    private let background = Color(red: 24.0 / 255.0, green: 29.0 / 255.0, blue: 28.0 / 255.0)

    var body: some View {
        ZStack {
            background.ignoresSafeArea()
            GameWebView()
        }
    }
}

