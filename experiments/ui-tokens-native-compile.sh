#!/usr/bin/env bash
# Compile the Swift and Kotlin golden files of ui-tokens against minimal
# stand-ins of the SwiftUI and Jetpack Compose types they use (no Apple or
# Android SDK needed), and run them to check the values are initialised.
# Usage: experiments/ui-tokens-native-compile.sh [work-dir]
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
golden="$here/packages/ui-tokens/tests/golden"
work="${1:-$(mktemp -d)}"
mkdir -p "$work"

if command -v swiftc >/dev/null; then
  for file in "$golden/Tokens.swift" "$golden/full/BrandTokens.swift"; do
    {
      echo 'import Foundation'
      echo 'public struct Color { public init(red: Double, green: Double, blue: Double, opacity: Double) {} }'
      echo 'public struct Font { public enum Weight { case ultraLight, thin, light, regular, medium, semibold, bold, heavy, black } }'
      grep -v '^import SwiftUI' "$file"
      echo 'print("swift ok:", '"$(basename "$file" .swift)"'.self)'
    } > "$work/main.swift"
    swiftc -o "$work/swift-check" "$work/main.swift"
    "$work/swift-check"
  done
else
  echo 'swiftc not found: Swift skipped'
fi

if command -v kotlinc >/dev/null; then
  stubs="$work/Stubs.kt"
  cat > "$stubs" <<'KT'
@file:Suppress("unused")
package androidx.compose.ui.graphics
@JvmInline value class Color(val value: Long)
KT
  cat > "$work/Unit.kt" <<'KT'
package androidx.compose.ui.unit
@JvmInline value class Dp(val value: Float)
val Int.dp: Dp get() = Dp(this.toFloat())
val Double.dp: Dp get() = Dp(this.toFloat())
@JvmInline value class TextUnit(val value: Float)
val Int.sp: TextUnit get() = TextUnit(this.toFloat())
val Double.sp: TextUnit get() = TextUnit(this.toFloat())
KT
  cat > "$work/Font.kt" <<'KT'
package androidx.compose.ui.text.font
class FontWeight(val weight: Int) { override fun toString() = "FontWeight($weight)" }
KT
  cat > "$work/Easing.kt" <<'KT'
package androidx.compose.animation.core
data class CubicBezierEasing(val a: Float, val b: Float, val c: Float, val d: Float)
KT
  cat > "$work/Main.kt" <<'KT'
import com.example.brand.BrandTokens
fun main() {
  check(Tokens.SpaceMedium.value == 16f)
  check(BrandTokens.ColorAction == BrandTokens.ColorPrimary)
  check(BrandTokens.Dark.ColorAction == BrandTokens.Dark.ColorPrimary)
  check(BrandTokens.SpaceGap.value == 8f)
  check(BrandTokens.TypeBody.fontWeight.weight == 700)
  println("kotlin ok: ${BrandTokens.ElevationHigh.size} shadow layers, ${Tokens.MotionDurationShortMs} ms")
}
KT
  kotlinc "$work"/{Stubs,Unit,Font,Easing,Main}.kt "$golden/Tokens.kt" "$golden/full/BrandTokens.kt" \
    -include-runtime -d "$work/check.jar" 2>&1 | grep -v '^warning' || true
  java -jar "$work/check.jar"
else
  echo 'kotlinc not found: Kotlin skipped'
fi
