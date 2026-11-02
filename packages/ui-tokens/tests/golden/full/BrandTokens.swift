import SwiftUI

public enum BrandTokens {
  public struct Shadow {
    public let color: Color
    public let offsetX: CGFloat
    public let offsetY: CGFloat
    public let blur: CGFloat
    public let spread: CGFloat
    public let inset: Bool
  }

  public struct Typography {
    public let fontFamily: [String]
    public let fontSize: CGFloat
    public let fontWeight: Font.Weight
    public let letterSpacing: CGFloat
    public let lineHeight: Double
  }

  /// Text on surfaces
  public static let colorNeutral = Color(red: 0.11, green: 0.106, blue: 0.122, opacity: 1)
  public static let spaceSmall: CGFloat = 8
  public static let fontWeightStrong: Font.Weight = .bold
  /// Brand colour
  public static let colorPrimary = Color(red: 0.404, green: 0.314, blue: 0.643, opacity: 1)
  public static let colorOnPrimary = Color(red: 1, green: 1, blue: 1, opacity: 1)
  public static let colorAction = BrandTokens.colorPrimary
  public static let colorScrim = Color(red: 0, green: 0, blue: 0, opacity: 0.502)
  public static let colorAccent = Color(red: 0.68, green: 0.528, blue: 0.929, opacity: 1)
  public static let spaceMedium: CGFloat = 16
  public static let spaceGap: CGFloat = BrandTokens.spaceSmall
  public static let sizeRoot: CGFloat = 16
  public static let motionDurationShort: TimeInterval = 0.15
  public static let motionEasingStandard: (x1: Double, y1: Double, x2: Double, y2: Double) = (0.2, 0, 0, 1)
  public static let opacityDisabled: Double = 0.38
  public static let fontFamilyBody: [String] = ["Roboto", "Noto Sans", "sans-serif"]
  public static let fontWeightRegular: Font.Weight = .regular
  public static let elevationLow: Shadow = Shadow(color: Color(red: 0, green: 0, blue: 0, opacity: 0.502), offsetX: 0, offsetY: 1, blur: 3, spread: 0, inset: false)
  public static let elevationHigh: [Shadow] = [Shadow(color: Color(red: 0, green: 0, blue: 0, opacity: 0.502), offsetX: 0, offsetY: 1, blur: 3, spread: 0, inset: false), Shadow(color: Color(red: 0, green: 0, blue: 0, opacity: 0.302), offsetX: 0, offsetY: 4, blur: 8, spread: 3, inset: true)]
  public static let typeBody: Typography = Typography(fontFamily: ["Roboto", "Noto Sans", "sans-serif"], fontSize: 16, fontWeight: .bold, letterSpacing: 0.5, lineHeight: 1.5)

  /// The tokens the mode "dark" changes.
  public enum Dark {
    public static let colorPrimary = Color(red: 0.816, green: 0.737, blue: 1, opacity: 1)
    public static let colorOnPrimary = Color(red: 0.22, green: 0.118, blue: 0.447, opacity: 1)
    public static let colorAction = BrandTokens.Dark.colorPrimary
    public static let colorSurface = Color(red: 0.078, green: 0.071, blue: 0.094, opacity: 1)
  }
}
