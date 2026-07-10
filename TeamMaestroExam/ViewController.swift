import UIKit
import WebKit

class ViewController: UIViewController {

    private var webView: WKWebView!
    private let targetURL = URL(string: "https://exam.riyasict.com")!
    private let lastURLKey = "lastVisitedURL"

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupWebView()
        loadInitialURL()
        observeLifecycle()
    }

    override var prefersStatusBarHidden: Bool { false }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    // MARK: - Setup

    private func setupWebView() {
        let config = WKWebViewConfiguration()

        // Persistent store: retains cookies, localStorage, IndexedDB across launches
        config.websiteDataStore = WKWebsiteDataStore.default()

        // Enable JavaScript
        let pagePrefs = WKWebpagePreferences()
        pagePrefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = pagePrefs
        config.preferences.javaScriptCanOpenWindowsAutomatically = true

        // Allow inline media playback
        config.allowsInlineMediaPlayback = true

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self

        // Swipe left/right to navigate back/forward within the webview
        webView.allowsBackForwardNavigationGestures = true

        webView.isOpaque = false
        webView.backgroundColor = .black

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    private func loadInitialURL() {
        // Restore last page within the target domain; otherwise fall back to root
        let urlToLoad: URL
        if let saved = UserDefaults.standard.string(forKey: lastURLKey),
           let savedURL = URL(string: saved),
           savedURL.host == targetURL.host
        {
            urlToLoad = savedURL
        } else {
            urlToLoad = targetURL
        }
        var request = URLRequest(url: urlToLoad)
        request.cachePolicy = .returnCacheDataElseLoad
        webView.load(request)
    }

    private func observeLifecycle() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(persistSession),
            name: .appWillResignActive,
            object: nil
        )
    }

    // MARK: - Session persistence

    @objc private func persistSession() {
        if let url = webView.url {
            UserDefaults.standard.set(url.absoluteString, forKey: lastURLKey)
        }
        // Flush WKHTTPCookieStore → HTTPCookieStorage so the OS writes them to disk
        webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { cookies in
            for cookie in cookies {
                HTTPCookieStorage.shared.setCookie(cookie)
            }
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}

// MARK: - WKNavigationDelegate

extension ViewController: WKNavigationDelegate {

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if let url = webView.url {
            UserDefaults.standard.set(url.absoluteString, forKey: lastURLKey)
        }
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
        switch url.scheme?.lowercased() {
        case "https", "http":
            decisionHandler(.allow)
        case "mailto", "tel", "facetime":
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        default:
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        retryIfNeeded(error: error)
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        retryIfNeeded(error: error)
    }

    private func retryIfNeeded(error: Error) {
        let code = (error as NSError).code
        guard code != NSURLErrorCancelled else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            guard let self, !self.webView.isLoading else { return }
            self.webView.load(URLRequest(url: self.targetURL))
        }
    }
}

// MARK: - WKUIDelegate (JavaScript dialogs)

extension ViewController: WKUIDelegate {

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (String?) -> Void
    ) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { tf in tf.text = defaultText }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler(alert.textFields?.first?.text)
        })
        present(alert, animated: true)
    }
}
