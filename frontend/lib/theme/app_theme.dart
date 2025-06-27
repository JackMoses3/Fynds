import 'package:flutter/material.dart';

class AppTheme {
  // Primary brand colors - matching your Figma design
  static const Color primaryColor = Color(
    0xFFFF0048,
  ); // Your existing pink/magenta
  static const Color secondaryColor = Color(
    0xFFFF1A5C,
  ); // Slightly lighter variant
  static const Color accentColor = Color(0xFFFF3366); // For highlights

  // Surface and background colors
  static const Color backgroundColor = Colors.white;
  static const Color surfaceColor = Colors.white;
  static const Color cardColor = Color(0xFFFAFAFA);
  static const Color dividerColor = Color(0xFFE0E0E0);

  // Text colors
  static const Color textPrimary = Color(
    0xFF1A1A1A,
  ); // Darker black for better readability
  static const Color textSecondary = Color(0xFF666666);
  static const Color textDisabled = Color(0xFF9E9E9E);
  static const Color textBody = Color(0xFF333333);
  static const Color textOnPrimary = Colors.white;
  static const Color textOnSurface = Color(0xFF1A1A1A);

  // Interactive colors
  static const Color buttonPrimary = primaryColor;
  static const Color buttonSecondary = Color(
    0xFF000000,
  ); // Black buttons as seen in design
  static const Color buttonDisabled = Color(0xFFE0E0E0);
  static const Color inputBorder = Color(0xFFE0E0E0);
  static const Color inputFocus = primaryColor;

  // Status colors
  static const Color successColor = Color(0xFF4CAF50);
  static const Color warningColor = Color(0xFFFF9800);
  static const Color errorColor = Color(0xFFE53E3E);
  static const Color infoColor = Color(0xFF2196F3);

  // Chip colors (for tags/categories)
  static const Color chipBackground = Color(
    0xFF000000,
  ); // Black chips as seen in design
  static const Color chipText = Colors.white;
  static const Color chipSelectedBackground = primaryColor;
  static const Color chipSelectedText = Colors.white;

  // Get the app's color scheme
  static ColorScheme get colorScheme => const ColorScheme(
    brightness: Brightness.light,
    primary: primaryColor,
    onPrimary: textOnPrimary,
    secondary: secondaryColor,
    onSecondary: Colors.white,
    tertiary: accentColor,
    onTertiary: Colors.white,
    error: errorColor,
    onError: Colors.white,
    surface: surfaceColor,
    onSurface: textOnSurface,
    outline: dividerColor,
    outlineVariant: inputBorder,
    onSurfaceVariant: textSecondary,
  );

  // Get the app's text theme
  static TextTheme get textTheme => const TextTheme(
    // Display styles (for large headers)
    displayLarge: TextStyle(
      fontSize: 57,
      fontWeight: FontWeight.w400,
      color: textPrimary,
      letterSpacing: -0.25,
    ),
    displayMedium: TextStyle(
      fontSize: 45,
      fontWeight: FontWeight.w400,
      color: textPrimary,
    ),
    displaySmall: TextStyle(
      fontSize: 36,
      fontWeight: FontWeight.w400,
      color: textPrimary,
    ),

    // Headline styles (for section headers)
    headlineLarge: TextStyle(
      fontSize: 32,
      fontWeight: FontWeight.w700,
      color: textPrimary,
      letterSpacing: 0.25,
    ),
    headlineMedium: TextStyle(
      fontSize: 28,
      fontWeight: FontWeight.w600,
      color: textPrimary,
    ),
    headlineSmall: TextStyle(
      fontSize: 24,
      fontWeight: FontWeight.w600,
      color: textPrimary,
    ),

    // Title styles (for card titles, app bars)
    titleLarge: TextStyle(
      fontSize: 22,
      fontWeight: FontWeight.w600,
      color: textPrimary,
      letterSpacing: 0.15,
    ),
    titleMedium: TextStyle(
      fontSize: 18,
      fontWeight: FontWeight.w600,
      color: textPrimary,
      letterSpacing: 0.15,
    ),
    titleSmall: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: textPrimary,
      letterSpacing: 0.1,
    ),

    // Label styles (for buttons, chips)
    labelLarge: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: textPrimary,
      letterSpacing: 0.1,
    ),
    labelMedium: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: textPrimary,
      letterSpacing: 0.5,
    ),
    labelSmall: TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.w600,
      color: textSecondary,
      letterSpacing: 0.5,
    ),

    // Body styles (for content text)
    bodyLarge: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w400,
      color: textBody,
      letterSpacing: 0.15,
    ),
    bodyMedium: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w400,
      color: textBody,
      letterSpacing: 0.25,
    ),
    bodySmall: TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.w400,
      color: textSecondary,
      letterSpacing: 0.4,
    ),
  );

  // Get the complete theme data
  static ThemeData get lightTheme => ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    textTheme: textTheme,
    fontFamily: 'SF Pro Display', // iOS-style font to match your design
    // App Bar Theme
    appBarTheme: const AppBarTheme(
      backgroundColor: backgroundColor,
      foregroundColor: textPrimary,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: textPrimary,
      ),
    ),

    // Elevated Button Theme
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: buttonPrimary,
        foregroundColor: textOnPrimary,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),

    // Outlined Button Theme (for secondary buttons)
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: buttonSecondary,
        side: const BorderSide(color: buttonSecondary, width: 1.5),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),

    // Text Button Theme
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: primaryColor,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),

    // Input Decoration Theme
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: backgroundColor,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: inputBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: inputBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: inputFocus, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: errorColor),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      hintStyle: const TextStyle(color: textSecondary),
    ),

    // Card Theme
    cardTheme: CardTheme(
      color: cardColor,
      elevation: 2,
      shadowColor: Colors.black,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),

    // Chip Theme
    chipTheme: const ChipThemeData(
      backgroundColor: chipBackground,
      labelStyle: TextStyle(
        color: chipText,
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      selectedColor: chipSelectedBackground,
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(20)),
      ),
    ),

    // Bottom Navigation Bar Theme
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: backgroundColor,
      selectedItemColor: primaryColor,
      unselectedItemColor: textSecondary,
      type: BottomNavigationBarType.fixed,
      elevation: 8,
    ),
  );
}
