// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "LocalActionServer",
    platforms: [ .macOS(.v12), .iOS(.v15) ],
    products: [
        .library(name: "RemoteTestToolsClient", targets: ["RemoteTestToolsClient"]),
    ],
    targets: [
        .target(name: "RemoteTestToolsClient", path: "modules/swift-client/Sources/OpenAPIs")
    ]
)