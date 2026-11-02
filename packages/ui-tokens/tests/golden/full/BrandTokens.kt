package com.example.brand

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object BrandTokens {
    data class Shadow(
        val color: Color,
        val offsetX: Dp,
        val offsetY: Dp,
        val blur: Dp,
        val spread: Dp,
        val inset: Boolean = false,
    )

    data class Typography(
        val fontFamily: List<String>,
        val fontSize: TextUnit,
        val fontWeight: FontWeight,
        val letterSpacing: TextUnit,
        val lineHeight: Float,
    )

    /** Text on surfaces */
    val ColorNeutral = Color(0xFF1C1B1F)
    val SpaceSmall = 8.dp
    val FontWeightStrong = FontWeight(700)
    /** Brand colour */
    val ColorPrimary = Color(0xFF6750A4)
    val ColorOnPrimary = Color(0xFFFFFFFF)
    val ColorAction = BrandTokens.ColorPrimary
    val ColorScrim = Color(0x80000000)
    val ColorAccent = Color(0xFFAD87ED)
    val SpaceMedium = 16.dp
    val SpaceGap = BrandTokens.SpaceSmall
    val SizeRoot = 16.dp
    const val MotionDurationShortMs = 150
    val MotionEasingStandard = CubicBezierEasing(0.2f, 0f, 0f, 1f)
    const val OpacityDisabled = 0.38f
    val FontFamilyBody = listOf("Roboto", "Noto Sans", "sans-serif")
    val FontWeightRegular = FontWeight(400)
    val ElevationLow = Shadow(Color(0x80000000), 0.dp, 1.dp, 3.dp, 0.dp, false)
    val ElevationHigh = listOf(Shadow(Color(0x80000000), 0.dp, 1.dp, 3.dp, 0.dp, false), Shadow(Color(0x4D000000), 0.dp, 4.dp, 8.dp, 3.dp, true))
    val TypeBody = Typography(listOf("Roboto", "Noto Sans", "sans-serif"), 16.sp, FontWeight(700), 0.5.sp, 1.5f)

    /** The tokens the mode "dark" changes. */
    object Dark {
        val ColorPrimary = Color(0xFFD0BCFF)
        val ColorOnPrimary = Color(0xFF381E72)
        val ColorAction = BrandTokens.Dark.ColorPrimary
        val ColorSurface = Color(0xFF141218)
    }
}
