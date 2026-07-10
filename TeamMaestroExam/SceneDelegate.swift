import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = ViewController()
        window?.makeKeyAndVisible()
    }

    func sceneWillResignActive(_ scene: UIScene) {
        NotificationCenter.default.post(name: .appWillResignActive, object: nil)
    }
}

extension Notification.Name {
    static let appWillResignActive = Notification.Name("AppWillResignActive")
}
