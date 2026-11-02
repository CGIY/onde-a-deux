import SwiftUI
import UIKit
import WebKit

/// The prototype and its resources are bundled in the application.
/// No server or JavaScript/native message bridge is required.
struct GameWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = true
        webView.backgroundColor = UIColor(red: 24.0 / 255.0, green: 29.0 / 255.0, blue: 28.0 / 255.0, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.alwaysBounceVertical = false
        webView.allowsBackForwardNavigationGestures = false

        #if DEBUG
        webView.isInspectable = true
        #endif

        guard let fileURL = Bundle.main.url(
            forResource: "index",
            withExtension: "html",
            subdirectory: "Web"
        ) else {
            webView.loadHTMLString(
                """
                <html lang="fr"><meta name="viewport" content="width=device-width,initial-scale=1">
                <body style="font:17px -apple-system;padding:28px;background:#181d1c;color:#ecebe1">
                <h1>Dés·ir</h1><p>La ressource Web/index.html est introuvable dans l’application.</p>
                <p>Vérifiez la phase Copy Bundle Resources du projet Xcode.</p></body></html>
                """,
                baseURL: nil
            )
            return webView
        }

        let webRoot = fileURL.deletingLastPathComponent()
        context.coordinator.webRoot = webRoot
        webView.loadFileURL(fileURL, allowingReadAccessTo: webRoot)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // Keep the existing page and game state when SwiftUI updates the view.
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var webRoot: URL?
        private var lastExternalURL: URL?
        private var lastExternalOpen = Date.distantPast

        private func isBundledFile(_ url: URL) -> Bool {
            guard url.isFileURL, let webRoot else { return false }
            let rootPath = webRoot.standardizedFileURL.resolvingSymlinksInPath().path
            let path = url.standardizedFileURL.resolvingSymlinksInPath().path
            return path == rootPath || path.hasPrefix(rootPath + "/")
        }

        private func openExternalLink(_ action: WKNavigationAction) {
            guard action.navigationType == .linkActivated,
                  let url = action.request.url,
                  url.scheme?.lowercased() == "https",
                  url.host != nil else { return }

            // Both delegate callbacks can receive the same target="_blank" link.
            let date = Date()
            guard url != lastExternalURL || date.timeIntervalSince(lastExternalOpen) > 0.75 else { return }
            lastExternalURL = url
            lastExternalOpen = date
            UIApplication.shared.open(url)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            if isBundledFile(url) || url.absoluteString == "about:blank" {
                decisionHandler(.allow)
                return
            }

            // Study/source links open in the system browser. Remote documents
            // never replace the local game inside this web view.
            openExternalLink(navigationAction)
            decisionHandler(.cancel)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            guard navigationAction.targetFrame == nil else { return nil }
            if let url = navigationAction.request.url, isBundledFile(url) {
                webView.load(navigationAction.request)
            } else {
                openExternalLink(navigationAction)
            }
            return nil
        }
    }
}

