// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "RemoteTestToolsClient",
    platforms: [
        .macOS(.v12),
        .iOS(.v15)
    ],
    products: [
        .library(
            name: "RemoteTestToolsClient",
            targets: ["RemoteTestToolsClient"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.0")
    ],
    targets: [
        .target(
            name: "RemoteTestToolsClient",
            dependencies: ["Alamofire"],
            path: "Sources/OpenAPIs"
        ),
    ]
)